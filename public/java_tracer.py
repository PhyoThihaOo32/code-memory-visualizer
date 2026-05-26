"""
java_tracer.py  –  Java mini-interpreter for MemViz (runs inside Pyodide)
Supports: int/double/boolean/String, arrays, classes (fields+constructors+methods),
          recursion, for/while/if-else, System.out.println.
"""

import json

# ──────────────────────────────────────────────────────────────
# TOKENISER
# ──────────────────────────────────────────────────────────────

JAVA_KW = {
    'int','double','float','boolean','char','void','String','Object',
    'class','if','else','while','for','return','new','null','static',
    'true','false','public','private','protected','this','super',
    'extends','implements','interface','abstract','final',
}

def _lex(src):
    toks, i, line = [], 0, 1
    n = len(src)
    while i < n:
        c = src[i]
        if c == '\n': line += 1; i += 1; continue
        if c in ' \t\r': i += 1; continue
        if c == '/' and i+1 < n and src[i+1] == '/':
            while i < n and src[i] != '\n': i += 1
            continue  # ← must be outside the inner while to continue the OUTER loop
        if c == '/' and i+1 < n and src[i+1] == '*':
            i += 2
            while i < n-1:
                if src[i] == '\n': line += 1
                if src[i] == '*' and src[i+1] == '/': i += 2; break
                i += 1
            continue
        if c == '@':  # annotation - skip line
            while i < n and src[i] != '\n': i += 1
            continue  # same fix — continue the outer loop
        if c == '"':
            i += 1; s = []
            while i < n and src[i] != '"':
                if src[i] == '\\' and i+1 < n:
                    i += 1; s.append({'n':'\n','t':'\t','\\':'\\','"':'"','r':'\r'}.get(src[i],src[i]))
                else: s.append(src[i])
                i += 1
            i += 1
            toks.append({'k':'STR','v':''.join(s),'l':line}); continue
        if c == "'":
            i += 1; ch = src[i]
            if ch == '\\' and i+1 < n: i += 1; ch = src[i]
            i += 1
            if i < n and src[i] == "'": i += 1
            toks.append({'k':'CHAR','v':ch,'l':line}); continue
        if c.isdigit() or (c == '.' and i+1 < n and src[i+1].isdigit()):
            s = []
            while i < n and (src[i].isdigit() or src[i] in '.eEfFdDlL'): s.append(src[i]); i += 1
            toks.append({'k':'NUM','v':''.join(s),'l':line}); continue
        if c.isalpha() or c == '_':
            s = []
            while i < n and (src[i].isalnum() or src[i] == '_'): s.append(src[i]); i += 1
            w = ''.join(s)
            toks.append({'k':'KW' if w in JAVA_KW else 'ID','v':w,'l':line}); continue
        two = src[i:i+2]
        if two in {'==','!=','<=','>=','&&','||','++','--','+=','-=','*=','/=','::'}:
            toks.append({'k':'OP','v':two,'l':line}); i += 2; continue
        if c in '+-*/%=<>!&|^~': toks.append({'k':'OP','v':c,'l':line}); i += 1; continue
        if c in ';{}()[],.:?': toks.append({'k':'PT','v':c,'l':line}); i += 1; continue
        i += 1
    toks.append({'k':'EOF','v':'','l':line})
    return toks

# ──────────────────────────────────────────────────────────────
# PARSER
# ──────────────────────────────────────────────────────────────

class Parser:
    def __init__(self, toks):
        self.toks = toks; self.pos = 0

    def peek(self): return self.toks[self.pos]
    def advance(self): t = self.toks[self.pos]; self.pos += 1; return t
    def check(self, *kv):
        t = self.peek()
        for k,v in kv:
            if t['k'] == k and t['v'] == v: return True
        return False
    def eat(self, k, v=None):
        t = self.advance()
        if t['k'] != k or (v is not None and t['v'] != v):
            raise SyntaxError(f"Expected {k}={v!r} got {t['k']}={t['v']!r} at line {t['l']}")
        return t
    def match(self, k, v=None):
        if self.peek()['k'] == k and (v is None or self.peek()['v'] == v):
            return self.advance()
        return None

    def _is_type(self):
        t = self.peek()
        return (t['k'] == 'KW' and t['v'] in {'int','double','float','boolean','char','void','String'}) \
            or t['k'] == 'ID'

    def _parse_type(self):
        t = self.advance()['v']
        # Generic type params (skip)
        if self.peek()['k'] == 'OP' and self.peek()['v'] == '<':
            depth = 0
            while self.peek()['k'] != 'EOF':
                if self.peek()['v'] == '<':
                    depth += 1; self.advance()
                elif self.peek()['v'] == '>':
                    depth -= 1; self.advance()
                    if depth == 0: break
                else:
                    self.advance()
        # Array: [] or [][]
        arr_dims = 0
        while self.peek()['k'] == 'PT' and self.peek()['v'] == '[':
            self.advance()
            if not (self.peek()['k'] == 'PT' and self.peek()['v'] == ']'):
                pass  # size in new expr, not in type
            if self.peek()['k'] == 'PT' and self.peek()['v'] == ']':
                self.advance()
            arr_dims += 1
        return t + '[]' * arr_dims

    def parse_program(self):
        decls = []
        while self.peek()['k'] != 'EOF':
            t = self.peek()
            # skip access modifiers
            if t['k'] == 'KW' and t['v'] in ('public','private','protected','abstract','final'):
                self.advance(); continue
            if t['k'] == 'KW' and t['v'] == 'class':
                decls.append(self.parse_class())
            else:
                self.advance()  # skip unexpected tokens
        return {'t':'Program','decls':decls}

    def parse_class(self):
        line = self.peek()['l']
        self.eat('KW','class')
        name = self.advance()['v']
        # extends/implements (skip)
        while self.peek()['k'] == 'KW' and self.peek()['v'] in ('extends','implements'):
            self.advance(); self.advance()
            while self.peek()['k'] == 'PT' and self.peek()['v'] == ',':
                self.advance(); self.advance()
        self.eat('PT','{')
        fields = []; methods = []; inner_classes = []
        while not self.check(('PT','}')):
            t = self.peek()
            # skip modifiers
            mods = []
            while t['k'] == 'KW' and t['v'] in ('public','private','protected','static','final','abstract','synchronized','override','@'):
                mods.append(self.advance()['v']); t = self.peek()
            if t['k'] == 'KW' and t['v'] == 'class':
                inner_classes.append(self.parse_class()); continue
            if t['k'] in ('ID','KW') and self._is_type():
                # could be field, method, or constructor
                typ = self._parse_type()
                if self.check(('PT','(')):
                    # Constructor: ClassName(params) — type string IS the constructor name
                    methods.append(self.parse_method_rest(typ, typ, 'static' in mods, line))
                elif self.peek()['k'] not in ('ID','KW'):
                    self.advance(); continue
                else:
                    mname = self.advance()['v']
                    if self.check(('PT','(')):
                        # method
                        methods.append(self.parse_method_rest(typ, mname, 'static' in mods, line))
                    else:
                        # field
                        init = None
                        if self.match('OP','='): init = self._parse_expr()
                        self.eat('PT',';')
                        fields.append({'name':mname,'type':typ,'init':init})
            else:
                self.advance()  # skip
        self.eat('PT','}')
        return {'t':'ClassDecl','name':name,'fields':fields,'methods':methods,
                'innerClasses':inner_classes,'line':line}

    def parse_method_rest(self, rtype, name, is_static, line):
        self.eat('PT','(')
        params = []
        while not self.check(('PT',')')):
            ptype = self._parse_type()
            if self.peek()['k'] in ('ID','KW') and not self.check(('PT',')')) and not self.check(('PT',',')):
                pname = self.advance()['v']
            else:
                pname = f'_p{len(params)}'
            params.append({'type':ptype,'name':pname})
            self.match('PT',',')
        self.eat('PT',')')
        # throws clause
        if self.peek()['k'] == 'KW' and self.peek()['v'] == 'throws':
            self.advance()
            while self.peek()['k'] in ('ID','KW') and self.peek()['v'] not in ('{',';'):
                self.advance(); self.match('PT',',')
        if self.check(('PT','{')):
            body = self.parse_block()
        else:
            self.eat('PT',';'); body = {'t':'Block','stmts':[],'line':line}
        return {'t':'MethodDecl','name':name,'rtype':rtype,'params':params,
                'isStatic':is_static,'body':body,'line':line}

    def parse_block(self):
        line = self.peek()['l']
        self.eat('PT','{'); stmts = []
        while not self.check(('PT','}')):
            stmts.append(self.parse_stmt())
        self.eat('PT','}')
        return {'t':'Block','stmts':stmts,'line':line}

    def parse_stmt(self):
        t = self.peek()
        if t['k'] == 'PT' and t['v'] == '{': return self.parse_block()
        if t['k'] == 'KW':
            v = t['v']
            if v == 'if':     return self.parse_if()
            if v == 'while':  return self.parse_while()
            if v == 'for':    return self.parse_for()
            if v == 'return': return self.parse_return()
            if v in ('int','double','float','boolean','char','void','String'):
                return self.parse_local_var()
        # ID that could be a class name used as type
        if t['k'] == 'ID' and self._peek_is_decl():
            return self.parse_local_var()
        e = self._parse_expr(); self.eat('PT',';')
        return {'t':'ExprStmt','expr':e,'line':t['l']}

    def _peek_is_decl(self):
        p = self.pos + 1
        # Only skip empty [] pairs (array type suffix like Node[]), not index access like arr[j]
        while (p + 1 < len(self.toks)
               and self.toks[p]['k'] == 'PT' and self.toks[p]['v'] == '['
               and self.toks[p+1]['k'] == 'PT' and self.toks[p+1]['v'] == ']'):
            p += 2
        return p < len(self.toks) and self.toks[p]['k'] in ('ID','KW')

    def parse_local_var(self):
        line = self.peek()['l']
        vtype = self._parse_type()
        name = self.advance()['v']
        init = None
        if self.match('OP','='): init = self._parse_expr()
        self.eat('PT',';')
        return {'t':'VarDecl','vtype':vtype,'name':name,'init':init,'line':line}

    def parse_if(self):
        line = self.peek()['l']
        self.eat('KW','if'); self.eat('PT','(')
        cond = self._parse_expr(); self.eat('PT',')')
        then = self.parse_stmt(); alt = None
        if self.match('KW','else'): alt = self.parse_stmt()
        return {'t':'If','cond':cond,'then':then,'alt':alt,'line':line}

    def parse_while(self):
        line = self.peek()['l']
        self.eat('KW','while'); self.eat('PT','(')
        cond = self._parse_expr(); self.eat('PT',')')
        body = self.parse_stmt()
        return {'t':'While','cond':cond,'body':body,'line':line}

    def parse_for(self):
        line = self.peek()['l']
        self.eat('KW','for'); self.eat('PT','(')
        if self.check(('PT',';')): init = None; self.advance()
        elif self._is_type():
            vtype = self._parse_type(); vname = self.advance()['v']
            vinit = None
            if self.match('OP','='): vinit = self._parse_expr()
            init = {'t':'VarDecl','vtype':vtype,'name':vname,'init':vinit,'line':line}
            self.eat('PT',';')
        else:
            init = self._parse_expr(); self.eat('PT',';')
        cond = None if self.check(('PT',';')) else self._parse_expr()
        self.eat('PT',';')
        update = None if self.check(('PT',')')) else self._parse_expr()
        self.eat('PT',')')
        body = self.parse_stmt()
        return {'t':'For','init':init,'cond':cond,'update':update,'body':body,'line':line}

    def parse_return(self):
        line = self.peek()['l']
        self.eat('KW','return')
        val = None if self.check(('PT',';')) else self._parse_expr()
        self.eat('PT',';')
        return {'t':'Return','val':val,'line':line}

    # ── expressions ──────────────────────────────────────────
    def _parse_expr(self): return self._parse_assign()

    def _parse_assign(self):
        l = self._parse_or()
        t = self.peek()
        if t['k'] == 'OP' and t['v'] in ('=','+=','-=','*=','/='):
            op = self.advance()['v']; r = self._parse_assign()
            return {'t':'Assign','op':op,'left':l,'right':r,'line':t['l']}
        return l

    def _parse_or(self):
        l = self._parse_and()
        while self.check(('OP','||')): op=self.advance()['v']; l={'t':'Bin','op':op,'l':l,'r':self._parse_and(),'line':self.peek()['l']}
        return l

    def _parse_and(self):
        l = self._parse_eq()
        while self.check(('OP','&&')): op=self.advance()['v']; l={'t':'Bin','op':op,'l':l,'r':self._parse_eq(),'line':self.peek()['l']}
        return l

    def _parse_eq(self):
        l = self._parse_cmp()
        while self.peek()['k']=='OP' and self.peek()['v'] in ('==','!='):
            op=self.advance()['v']; l={'t':'Bin','op':op,'l':l,'r':self._parse_cmp(),'line':self.peek()['l']}
        return l

    def _parse_cmp(self):
        l = self._parse_add()
        while self.peek()['k']=='OP' and self.peek()['v'] in ('<','>','<=','>='):
            op=self.advance()['v']; l={'t':'Bin','op':op,'l':l,'r':self._parse_add(),'line':self.peek()['l']}
        return l

    def _parse_add(self):
        l = self._parse_mul()
        while self.peek()['k']=='OP' and self.peek()['v'] in ('+','-'):
            op=self.advance()['v']; l={'t':'Bin','op':op,'l':l,'r':self._parse_mul(),'line':self.peek()['l']}
        return l

    def _parse_mul(self):
        l = self._parse_unary()
        while self.peek()['k']=='OP' and self.peek()['v'] in ('*','/','%'):
            op=self.advance()['v']; l={'t':'Bin','op':op,'l':l,'r':self._parse_unary(),'line':self.peek()['l']}
        return l

    def _parse_unary(self):
        t = self.peek()
        if t['k']=='OP' and t['v'] in ('-','!'):
            op=self.advance()['v']; return {'t':'Unary','op':op,'e':self._parse_unary(),'line':t['l']}
        if t['k']=='OP' and t['v'] in ('++','--'):
            op=self.advance()['v']; return {'t':'PreInc','op':op,'e':self._parse_unary(),'line':t['l']}
        return self._parse_postfix()

    def _parse_postfix(self):
        e = self._parse_primary()
        while True:
            t = self.peek()
            if t['k']=='PT' and t['v']=='.':
                self.advance(); member=self.advance()['v']
                if self.check(('PT','(')):
                    self.advance(); args=[]
                    while not self.check(('PT',')')):
                        args.append(self._parse_expr()); self.match('PT',',')
                    self.eat('PT',')')
                    e = {'t':'MethodCall','obj':e,'method':member,'args':args,'line':t['l']}
                else:
                    e = {'t':'Field','obj':e,'field':member,'line':t['l']}
            elif t['k']=='PT' and t['v']=='[':
                self.advance(); idx=self._parse_expr(); self.eat('PT',']')
                e = {'t':'Index','obj':e,'idx':idx,'line':t['l']}
            elif t['k']=='OP' and t['v'] in ('++','--'):
                op=self.advance()['v']; e={'t':'PostInc','op':op,'e':e,'line':t['l']}
            else:
                break
        return e

    def _parse_primary(self):
        t = self.peek()
        if t['k']=='NUM':
            self.advance()
            v = float(t['v'].rstrip('fFdD')) if ('.' in t['v'] or 'e' in t['v'].lower()) else int(t['v'].rstrip('lLfFdD'))
            return {'t':'Num','v':v,'line':t['l']}
        if t['k']=='STR':  self.advance(); return {'t':'Str','v':t['v'],'line':t['l']}
        if t['k']=='CHAR': self.advance(); return {'t':'Num','v':ord(t['v']),'line':t['l']}
        if t['k']=='KW' and t['v']=='true':  self.advance(); return {'t':'Bool','v':True,'line':t['l']}
        if t['k']=='KW' and t['v']=='false': self.advance(); return {'t':'Bool','v':False,'line':t['l']}
        if t['k']=='KW' and t['v']=='null':  self.advance(); return {'t':'Null','line':t['l']}
        if t['k']=='KW' and t['v']=='this':  self.advance(); return {'t':'This','line':t['l']}
        if t['k']=='KW' and t['v']=='new':
            self.advance(); ctype = self.advance()['v']
            # new int[] or new int[n]
            if self.check(('PT','[')):
                self.advance()
                size_expr = None if self.check(('PT',']')) else self._parse_expr()
                self.eat('PT',']')
                # array initializer?
                if self.check(('PT','{')):
                    self.advance(); elems=[]
                    while not self.check(('PT','}')):
                        elems.append(self._parse_expr()); self.match('PT',',')
                    self.eat('PT','}')
                    return {'t':'NewArray','etype':ctype,'elems':elems,'size':None,'line':t['l']}
                return {'t':'NewArray','etype':ctype,'elems':None,'size':size_expr,'line':t['l']}
            # new ClassName(args)
            self.eat('PT','('); args=[]
            while not self.check(('PT',')')):
                args.append(self._parse_expr()); self.match('PT',',')
            self.eat('PT',')')
            return {'t':'NewObj','ctype':ctype,'args':args,'line':t['l']}
        if t['k']=='PT' and t['v']=='(':
            self.advance(); e=self._parse_expr(); self.eat('PT',')'); return e
        if t['k']=='PT' and t['v']=='{':
            self.advance(); elems=[]
            while not self.check(('PT','}')):
                elems.append(self._parse_expr()); self.match('PT',',')
            self.eat('PT','}')
            return {'t':'ArrayLit','elems':elems,'line':t['l']}
        if t['k'] in ('ID','KW'):
            name=self.advance()['v']
            if self.check(('PT','(')):
                self.advance(); args=[]
                while not self.check(('PT',')')):
                    args.append(self._parse_expr()); self.match('PT',',')
                self.eat('PT',')')
                return {'t':'Call','name':name,'args':args,'line':t['l']}
            return {'t':'Ident','name':name,'line':t['l']}
        raise SyntaxError(f"Unexpected {t['k']}={t['v']!r} at line {t['l']}")

# ──────────────────────────────────────────────────────────────
# INTERPRETER
# ──────────────────────────────────────────────────────────────

class ReturnException(Exception):
    def __init__(self, val): self.val = val

class JavaInterpreter:
    MAX_STEPS = 2000

    def __init__(self):
        self.heap = {}
        self.heap_ctr = 0
        self.call_stack = []
        self.globals = {}
        self.classes = {}   # name -> ClassDecl
        self.stdout = ''
        self.snapshots = []
        self.step = 0
        self.this_stack = []  # stack of 'this' references

    def new_id(self):
        self.heap_ctr += 1; return f'h{self.heap_ctr}'

    def alloc_obj(self, class_name, fields):
        hid = self.new_id()
        self.heap[hid] = {'id': hid, 'typeName': class_name, 'fields': fields}
        return hid

    def frame(self): return self.call_stack[-1] if self.call_stack else None

    def get_var(self, name):
        for f in reversed(self.call_stack):
            if name in f['vars']: return f['vars'][name]
        if name in self.globals: return self.globals[name]
        raise NameError(f"Undefined variable '{name}'")

    def set_var(self, name, val):
        for f in reversed(self.call_stack):
            if name in f['vars']: f['vars'][name] = val; return
        if name in self.globals: self.globals[name] = val; return
        if self.call_stack: self.call_stack[-1]['vars'][name] = val
        else: self.globals[name] = val

    def declare_var(self, name, val):
        if self.call_stack: self.call_stack[-1]['vars'][name] = val
        else: self.globals[name] = val

    # ── snapshot ─────────────────────────────────────────────
    def snap(self, line, event='line'):
        if self.step >= self.MAX_STEPS: raise RuntimeError('Step limit')
        stack = []
        for f in self.call_stack:
            locs = {k: self._rv(v) for k, v in f['vars'].items()}
            frame = {'id': f['id'], 'name': f['name'], 'locals': locs}
            if 'return_val' in f:
                frame['returnValue'] = self._rv(f['return_val'])
            stack.append(frame)
        heap = {}
        for hid, obj in self.heap.items():
            if obj.get('isArray'):
                heap[hid] = {'kind':'list','id':hid,'items':[self._rv(e) for e in obj['elems']]}
            else:
                heap[hid] = {'kind':'object','id':hid,'type':obj['typeName'],
                             'attrs': {k: self._rv(v) for k, v in obj['fields'].items()}}
        globals_ = {k: self._rv(v) for k, v in self.globals.items()
                    if not callable(v) and not isinstance(v, dict)}
        self.snapshots.append({
            'step': self.step, 'line': line, 'stack': stack, 'heap': heap,
            'globals': globals_, 'event': event, 'highlight': None,
            'stdout': self.stdout,
        })
        self.step += 1

    def _rv(self, v):
        if v is None: return {'kind':'none'}
        if isinstance(v, str) and v.startswith('__ref__'):
            hid = v[7:]
            return {'kind':'none'} if hid == 'null' else {'kind':'ref','id':hid}
        if isinstance(v, bool): return {'kind':'primitive','value':v}
        if isinstance(v, (int,float)): return {'kind':'primitive','value':v}
        if isinstance(v, str): return {'kind':'primitive','value':v}
        return {'kind':'none'}

    # ── run ──────────────────────────────────────────────────
    def run(self, code):
        toks = _lex(code)
        ast = Parser(toks).parse_program()
        # collect class declarations
        for decl in ast['decls']:
            if decl['t'] == 'ClassDecl':
                self.classes[decl['name']] = decl
                # register inner classes
                for ic in decl.get('innerClasses', []):
                    self.classes[ic['name']] = ic
        # find main class (outer class with main method)
        main_class = None
        for cname, cls in self.classes.items():
            for m in cls.get('methods', []):
                if m['name'] == 'main': main_class = cname; break
            if main_class: break
        if not main_class:
            raise RuntimeError('No main method found')
        self.call_static_method(main_class, 'main', [])
        return self.snapshots

    def call_static_method(self, class_name, method_name, args):
        cls = self.classes.get(class_name)
        if not cls:
            raise RuntimeError(f"Class '{class_name}' not found")
        meth = next((m for m in cls['methods'] if m['name'] == method_name), None)
        if not meth:
            raise RuntimeError(f"Method '{method_name}' not found in {class_name}")
        return self._invoke_method(meth, args, this_ref=None, class_name=class_name)

    def call_instance_method(self, obj_ref, method_name, args):
        hid = obj_ref[7:] if isinstance(obj_ref, str) and obj_ref.startswith('__ref__') else None
        if not hid or hid == 'null': raise RuntimeError('NullPointerException')
        obj = self.heap[hid]
        type_name = obj['typeName']
        cls = self.classes.get(type_name)
        if not cls: raise RuntimeError(f"Class '{type_name}' not found")
        meth = next((m for m in cls['methods'] if m['name'] == method_name), None)
        if not meth: raise RuntimeError(f"Method '{method_name}' not found in {type_name}")
        return self._invoke_method(meth, args, this_ref=obj_ref, class_name=type_name)

    def _invoke_method(self, meth, arg_vals, this_ref, class_name):
        frame = {'name': f'{class_name}.{meth["name"]}',
                 'id': f'frame_{self.heap_ctr}_{meth["name"]}', 'vars': {}}
        self.heap_ctr += 1
        for p, v in zip(meth['params'], arg_vals):
            frame['vars'][p['name']] = v
        if this_ref: frame['vars']['this'] = this_ref
        self.call_stack.append(frame)
        self.this_stack.append(this_ref)
        self.snap(meth['line'], 'call')
        ret = None
        returned_explicitly = False
        try:
            self.exec_block(meth['body'])
        except ReturnException as r:
            ret = r.val
            frame['return_val'] = ret
            self.snap(meth['line'], 'return')
            returned_explicitly = True
        if not returned_explicitly:
            # void method fell off the end — emit a return snapshot so the frame visibly pops
            last_line = self.snapshots[-1]['line'] if self.snapshots else meth['line']
            self.snap(last_line, 'return')
        self.call_stack.pop()
        self.this_stack.pop()
        return ret

    def construct_object(self, class_name, args):
        cls = self.classes.get(class_name)
        if not cls: raise RuntimeError(f"Class '{class_name}' not found")
        # allocate with default field values
        fields = {f['name']: self._default(f['type']) for f in cls.get('fields', [])}
        hid = self.alloc_obj(class_name, fields)
        ref = '__ref__' + hid
        # find constructor (method with same name as class, or __init__)
        ctor = next((m for m in cls['methods'] if m['name'] == class_name), None)
        if ctor:
            self._invoke_method(ctor, args, this_ref=ref, class_name=class_name)
        elif args:
            # no explicit constructor, try to match fields in order
            for f, v in zip(cls.get('fields', []), args):
                self.heap[hid]['fields'][f['name']] = v
        return ref

    def exec_block(self, block):
        for stmt in block['stmts']: self.exec_stmt(stmt)

    def exec_stmt(self, stmt):
        t = stmt['t']
        if t == 'Block': self.exec_block(stmt); return
        if t == 'VarDecl':
            val = self.eval_expr(stmt['init']) if stmt['init'] else self._default(stmt['vtype'])
            self.declare_var(stmt['name'], val)
            self.snap(stmt['line']); return
        if t == 'ExprStmt':
            self.eval_expr(stmt['expr']); self.snap(stmt['line']); return
        if t == 'If':
            self.snap(stmt['line'])
            if self.eval_expr(stmt['cond']): self.exec_stmt(stmt['then'])
            elif stmt['alt']: self.exec_stmt(stmt['alt'])
            return
        if t == 'While':
            while True:
                self.snap(stmt['line'])
                if not self.eval_expr(stmt['cond']): break
                self.exec_stmt(stmt['body'])
            return
        if t == 'For':
            if stmt['init']:
                if isinstance(stmt['init'], dict) and stmt['init']['t'] == 'VarDecl':
                    self.exec_stmt(stmt['init'])
                else: self.eval_expr(stmt['init'])
            while True:
                self.snap(stmt['line'])
                if stmt['cond'] and not self.eval_expr(stmt['cond']): break
                self.exec_stmt(stmt['body'])
                if stmt['update']: self.eval_expr(stmt['update'])
            return
        if t == 'Return':
            val = self.eval_expr(stmt['val']) if stmt['val'] else None
            self.snap(stmt['line'], 'return'); raise ReturnException(val)

    def eval_expr(self, node):
        if node is None: return None
        t = node['t']
        if t == 'Num':  return node['v']
        if t == 'Str':  return node['v']
        if t == 'Bool': return node['v']
        if t == 'Null': return '__ref__null'
        if t == 'This': return self.this_stack[-1] if self.this_stack else None

        if t == 'Ident':
            name = node['name']
            # static method call like ClassName.method handled at MethodCall
            return self.get_var(name)

        if t == 'Bin':
            l = self.eval_expr(node['l']); r = self.eval_expr(node['r'])
            return self._binop(node['op'], l, r)

        if t == 'Unary':
            op = node['op']
            if op == '!': return not self.eval_expr(node['e'])
            if op == '-': return -self.eval_expr(node['e'])
            return self.eval_expr(node['e'])

        if t == 'PreInc':
            v = self.eval_expr(node['e'])
            nv = (v+1) if node['op']=='++'  else (v-1)
            self._assign_to(node['e'], nv); return nv

        if t == 'PostInc':
            v = self.eval_expr(node['e'])
            nv = (v+1) if node['op']=='++'  else (v-1)
            self._assign_to(node['e'], nv); return v

        if t == 'Assign':
            val = self.eval_expr(node['right'])
            if node['op'] != '=':
                old = self.eval_expr(node['left'])
                val = self._binop({'+=':'+','-=':'-','*=':'*','/=':'/'}[node['op']], old, val)
            self._assign_to(node['left'], val); return val

        if t == 'Index':
            ref = self.eval_expr(node['obj']); idx = int(self.eval_expr(node['idx']))
            if isinstance(ref, str) and ref.startswith('__ref__'):
                a = self.heap.get(ref[7:])
                if a and a.get('isArray'): return a['elems'][idx]
            return None

        if t == 'Field':
            ref = self.eval_expr(node['obj']); fname = node['field']
            if isinstance(ref, str) and ref.startswith('__ref__'):
                hid = ref[7:]
                if hid == 'null': raise RuntimeError('NullPointerException')
                # special: arr.length
                obj = self.heap.get(hid, {})
                if obj.get('isArray') and fname == 'length': return len(obj['elems'])
                return obj.get('fields', {}).get(fname)
            return None

        if t == 'MethodCall':
            mname = node['method']
            args = [self.eval_expr(a) for a in node['args']]
            # System.out.println — handle before evaluating obj to avoid NameError on 'System'
            if mname in ('println','print','printf'):
                txt = ' '.join(self._to_str(a) for a in args)
                if mname == 'println': txt += '\n'
                self.stdout += txt; return None
            obj = self.eval_expr(node['obj'])
            # String methods (simplified)
            if isinstance(obj, str) and not obj.startswith('__ref__'):
                if mname == 'length': return len(obj)
                if mname == 'charAt': return obj[int(args[0])] if args else ''
                if mname == 'substring': return obj[int(args[0]):int(args[1]) if len(args)>1 else None]
                return None
            # instance method call on heap object
            if isinstance(obj, str) and obj.startswith('__ref__'):
                return self.call_instance_method(obj, mname, args)
            return None

        if t == 'Call':
            name = node['name']; args = [self.eval_expr(a) for a in node['args']]
            # look for static method in known classes
            for cname, cls in self.classes.items():
                for m in cls['methods']:
                    if m['name'] == name:
                        return self.call_static_method(cname, name, args)
            raise RuntimeError(f"Undefined function '{name}'")

        if t == 'NewObj':
            args = [self.eval_expr(a) for a in node['args']]
            return self.construct_object(node['ctype'], args)

        if t == 'NewArray':
            if node['elems'] is not None:
                elems = [self.eval_expr(e) for e in node['elems']]
            else:
                size = int(self.eval_expr(node['size'])) if node['size'] else 0
                elems = [self._default(node['etype'])] * size
            hid = self.new_id()
            self.heap[hid] = {'id':hid,'typeName':node['etype']+'[]','isArray':True,'elems':elems,'fields':{}}
            return '__ref__' + hid

        if t == 'ArrayLit':
            elems = [self.eval_expr(e) for e in node['elems']]
            hid = self.new_id()
            self.heap[hid] = {'id':hid,'typeName':'array','isArray':True,'elems':elems,'fields':{}}
            return '__ref__' + hid

        return None

    def _assign_to(self, target, val):
        t = target['t']
        if t == 'Ident': self.set_var(target['name'], val)
        elif t == 'Field':
            ref = self.eval_expr(target['obj'])
            if isinstance(ref, str) and ref.startswith('__ref__'):
                self.heap[ref[7:]]['fields'][target['field']] = val
        elif t == 'Index':
            ref = self.eval_expr(target['obj']); idx = int(self.eval_expr(target['idx']))
            if isinstance(ref, str) and ref.startswith('__ref__'):
                a = self.heap.get(ref[7:])
                if a and a.get('isArray'): a['elems'][idx] = val

    def _binop(self, op, l, r):
        if op == '+':
            if isinstance(l, str) or isinstance(r, str):
                return self._to_str(l) + self._to_str(r)
            return l + r
        if op == '-': return l - r
        if op == '*': return l * r
        if op == '/':
            if isinstance(l,int) and isinstance(r,int): return l//r if r else 0
            return l/r if r else 0
        if op == '%': return l%r if r else 0
        if op == '==': return l == r
        if op == '!=': return l != r
        if op == '<':  return l < r
        if op == '>':  return l > r
        if op == '<=': return l <= r
        if op == '>=': return l >= r
        if op == '&&': return bool(l) and bool(r)
        if op == '||': return bool(l) or bool(r)
        return 0

    def _default(self, t):
        if t in ('int','double','float','char','long','short','byte'): return 0
        if t == 'boolean': return False
        if t == 'String': return ''
        return '__ref__null'

    def _to_str(self, v):
        if v is None or v == '__ref__null': return 'null'
        if isinstance(v, bool): return 'true' if v else 'false'
        if isinstance(v, float) and v == int(v): return str(int(v))
        if isinstance(v, str) and v.startswith('__ref__'): return '[object]'
        return str(v)

# ──────────────────────────────────────────────────────────────
# ENTRY POINT
# ──────────────────────────────────────────────────────────────

def run_java(code):
    interp = JavaInterpreter()
    try:
        snaps = interp.run(code)
    except Exception as e:
        snaps = interp.snapshots
        snaps.append({
            'step': interp.step, 'line': 0, 'stack': [], 'heap': {},
            'globals': {}, 'event': 'exception', 'highlight': None,
            'stdout': interp.stdout, 'error': str(e),
        })
    return json.dumps(snaps)
