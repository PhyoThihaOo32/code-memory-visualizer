"""
cpp_tracer.py  –  C++ mini-interpreter for MemViz (runs inside Pyodide)
Supports: int/double/bool/char/string, pointers, structs, arrays,
          functions, recursion, for/while/if-else, cout.
"""

import json, re

# ──────────────────────────────────────────────────────────────
# TOKENISER
# ──────────────────────────────────────────────────────────────

CPP_KW = {
    'int','double','float','bool','char','void','string','struct',
    'if','else','while','for','return','new','delete',
    'true','false','nullptr','const','auto','sizeof',
    'cout','endl','cin','using','namespace','std','include',
}

def _lex(src):
    toks, i, line = [], 0, 1
    n = len(src)
    while i < n:
        c = src[i]
        if c == '\n': line += 1; i += 1; continue
        if c in ' \t\r': i += 1; continue
        # single-line comment
        if c == '/' and i+1 < n and src[i+1] == '/':
            while i < n and src[i] != '\n': i += 1
            continue
        # multi-line comment
        if c == '/' and i+1 < n and src[i+1] == '*':
            i += 2
            while i < n-1:
                if src[i] == '\n': line += 1
                if src[i] == '*' and src[i+1] == '/': i += 2; break
                i += 1
            continue
        # preprocessor – skip line
        if c == '#':
            while i < n and src[i] != '\n': i += 1
            continue
        # string
        if c == '"':
            i += 1; s = []
            while i < n and src[i] != '"':
                if src[i] == '\\' and i+1 < n:
                    i += 1; s.append({'n':'\n','t':'\t','\\':'\\','"':'"','r':'\r'}.get(src[i],src[i]))
                else: s.append(src[i])
                i += 1
            i += 1
            toks.append({'k':'STR','v':''.join(s),'l':line}); continue
        # char
        if c == "'":
            i += 1; ch = src[i]
            if ch == '\\' and i+1 < n: i += 1; ch = src[i]
            i += 1
            if i < n and src[i] == "'": i += 1
            toks.append({'k':'CHAR','v':ch,'l':line}); continue
        # number
        if c.isdigit() or (c == '.' and i+1 < n and src[i+1].isdigit()):
            s = []
            while i < n and (src[i].isdigit() or src[i] in '.eEfFuUlL'): s.append(src[i]); i += 1
            toks.append({'k':'NUM','v':''.join(s),'l':line}); continue
        # identifier / keyword
        if c.isalpha() or c == '_':
            s = []
            while i < n and (src[i].isalnum() or src[i] == '_'): s.append(src[i]); i += 1
            w = ''.join(s)
            toks.append({'k':'KW' if w in CPP_KW else 'ID','v':w,'l':line}); continue
        # two-char operators
        two = src[i:i+2]
        if two in {'==','!=','<=','>=','&&','||','++','--','->','::','<<','>>','+=','-=','*=','/='}:
            toks.append({'k':'OP','v':two,'l':line}); i += 2; continue
        # single-char operators / punctuation
        if c in '+-*/%=<>!&|^~': toks.append({'k':'OP','v':c,'l':line}); i += 1; continue
        if c in ';{}()[],.:?': toks.append({'k':'PT','v':c,'l':line}); i += 1; continue
        i += 1
    toks.append({'k':'EOF','v':'','l':line})
    return toks

# ──────────────────────────────────────────────────────────────
# PARSER  (recursive descent)
# ──────────────────────────────────────────────────────────────

class Parser:
    def __init__(self, toks):
        self.toks = toks; self.pos = 0

    def peek(self): return self.toks[self.pos]
    def cur(self):  return self.toks[self.pos]
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

    # ── type parsing ────────────────────────────────────────
    def parse_type(self):
        t = self.advance()
        base = t['v']
        stars = 0
        while self.peek()['k'] == 'OP' and self.peek()['v'] == '*':
            self.advance(); stars += 1
        # eat [] for array params like int arr[]
        if self.peek()['k'] == 'PT' and self.peek()['v'] == '[':
            self.advance()
            if not (self.peek()['k'] == 'PT' and self.peek()['v'] == ']'):
                self._parse_expr()  # size expr, ignore
            self.eat('PT', ']')
            return base + '[]'
        return base + '*' * stars

    def _is_type_start(self):
        t = self.peek()
        if t['k'] == 'KW' and t['v'] in {'int','double','float','bool','char','void','string','auto'}: return True
        if t['k'] == 'ID': return True  # struct type
        return False

    # ── program ─────────────────────────────────────────────
    def parse_program(self):
        decls = []
        while self.peek()['k'] != 'EOF':
            t = self.peek()
            if t['k'] == 'KW' and t['v'] == 'struct':
                decls.append(self.parse_struct())
            elif t['k'] == 'KW' and t['v'] in ('using','namespace','include'):
                while self.peek()['k'] not in ('EOF',) and self.peek()['v'] != ';': self.advance()
                self.match('PT', ';')
            else:
                decls.append(self.parse_func_or_var())
        return {'t':'Program','decls':decls}

    def parse_struct(self):
        line = self.peek()['l']
        self.eat('KW','struct'); name = self.eat('ID')['v']
        self.eat('PT','{')
        fields = []
        while not self.check(('PT','}')):
            ftype = self.parse_type(); fname = self.eat('ID')['v']
            # optional default value (skip for simplicity)
            if self.check(('OP','=')):
                self.advance(); self._parse_expr()
            self.eat('PT',';')
            fields.append({'name':fname,'type':ftype})
        self.eat('PT','}'); self.eat('PT',';')
        return {'t':'StructDecl','name':name,'fields':fields,'line':line}

    def parse_func_or_var(self):
        line = self.peek()['l']
        rtype = self.parse_type()
        name = self.eat('ID')['v']
        if self.check(('PT','(')):
            return self.parse_func_rest(rtype, name, line)
        else:
            return self.parse_global_var(rtype, name, line)

    def parse_func_rest(self, rtype, name, line):
        self.eat('PT','(')
        params = []
        while not self.check(('PT',')')):
            ptype = self.parse_type()
            if self.peek()['k'] in ('ID','KW') and not self.check(('PT',')')) and not self.check(('PT',',')):
                pname = self.advance()['v']
            else:
                pname = f'_p{len(params)}'
            params.append({'type':ptype,'name':pname})
            self.match('PT',',')
        self.eat('PT',')')
        body = self.parse_block()
        return {'t':'FuncDecl','name':name,'rtype':rtype,'params':params,'body':body,'line':line}

    def parse_global_var(self, vtype, name, line):
        init = None
        if self.match('OP','='):
            init = self._parse_expr()
        self.eat('PT',';')
        return {'t':'VarDecl','vtype':vtype,'name':name,'init':init,'line':line}

    # ── statements ──────────────────────────────────────────
    def parse_block(self):
        line = self.peek()['l']
        self.eat('PT','{')
        stmts = []
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
            if v == 'cout':   return self.parse_cout()
            if v in ('int','double','float','bool','char','void','string','auto'):
                return self.parse_local_var()
        # struct-type variable declaration
        if t['k'] == 'ID' and self._peek_is_decl():
            return self.parse_local_var()
        # expression statement
        e = self._parse_expr()
        self.eat('PT',';')
        return {'t':'ExprStmt','expr':e,'line':t['l']}

    def _peek_is_decl(self):
        # heuristic: ID followed by ID or ID* ID
        p = self.pos + 1
        while p < len(self.toks) and self.toks[p]['k'] == 'OP' and self.toks[p]['v'] == '*':
            p += 1
        return p < len(self.toks) and self.toks[p]['k'] in ('ID','KW')

    def parse_local_var(self):
        line = self.peek()['l']
        vtype = self.parse_type()
        name = self.advance()['v']
        # Handle C-style array suffix after variable name: int arr[] or int arr[N]
        arr_size_expr = None
        if self.peek()['k'] == 'PT' and self.peek()['v'] == '[':
            self.advance()
            if not (self.peek()['k'] == 'PT' and self.peek()['v'] == ']'):
                arr_size_expr = self._parse_expr()
            if self.peek()['k'] == 'PT' and self.peek()['v'] == ']':
                self.advance()
            vtype = vtype + '[]'
        init = None
        if self.match('OP','='):
            init = self._parse_expr()
        elif arr_size_expr is not None:
            # int arr[5] with no initializer → default array
            init = {'t':'NewArray','etype':vtype[:-2],'elems':None,'size':arr_size_expr,'line':line}
        elif self.check(('PT','(')):
            # constructor call: Type name(args)
            self.eat('PT','(')
            args = []
            while not self.check(('PT',')')):
                args.append(self._parse_expr()); self.match('PT',',')
            self.eat('PT',')')
            init = {'t':'CtorCall','ctype':vtype,'args':args,'line':line}
        self.eat('PT',';')
        return {'t':'VarDecl','vtype':vtype,'name':name,'init':init,'line':line}

    def parse_if(self):
        line = self.peek()['l']
        self.eat('KW','if'); self.eat('PT','(')
        cond = self._parse_expr(); self.eat('PT',')')
        then = self.parse_stmt()
        alt = None
        if self.match('KW','else'):
            alt = self.parse_stmt()
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
        # init
        if self.check(('PT',';')): init = None; self.advance()
        elif self._is_type_start():
            vtype = self.parse_type(); vname = self.advance()['v']
            vinit = None
            if self.match('OP','='): vinit = self._parse_expr()
            init = {'t':'VarDecl','vtype':vtype,'name':vname,'init':vinit,'line':line}
            self.eat('PT',';')
        else:
            init = self._parse_expr(); self.eat('PT',';')
        # condition
        cond = None if self.check(('PT',';')) else self._parse_expr()
        self.eat('PT',';')
        # update
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

    def parse_cout(self):
        line = self.peek()['l']
        self.eat('KW','cout')
        args = []
        while self.check(('OP','<<')):
            self.advance()
            if self.check(('KW','endl')): self.advance(); args.append({'t':'Endl'})
            else: args.append(self._parse_expr())
        self.eat('PT',';')
        return {'t':'Cout','args':args,'line':line}

    # ── expressions (Pratt-style precedence) ────────────────
    def _parse_expr(self): return self._parse_assign()

    def _parse_assign(self):
        left = self._parse_or()
        t = self.peek()
        if t['k'] == 'OP' and t['v'] in ('=','+=','-=','*=','/='):
            op = self.advance()['v']; right = self._parse_assign()
            return {'t':'Assign','op':op,'left':left,'right':right,'line':t['l']}
        return left

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
        if t['k']=='OP' and t['v'] in ('-','!','*','&'):
            op=self.advance()['v']; return {'t':'Unary','op':op,'e':self._parse_unary(),'line':t['l']}
        if t['k']=='OP' and t['v'] in ('++','--'):
            op=self.advance()['v']; return {'t':'PreInc','op':op,'e':self._parse_unary(),'line':t['l']}
        return self._parse_postfix()

    def _parse_postfix(self):
        e = self._parse_primary()
        while True:
            t = self.peek()
            if t['k']=='OP' and t['v']=='->':
                self.advance(); field=self.advance()['v']
                e = {'t':'Arrow','obj':e,'field':field,'line':t['l']}
            elif t['k']=='PT' and t['v']=='.':
                self.advance(); field=self.advance()['v']
                e = {'t':'Dot','obj':e,'field':field,'line':t['l']}
            elif t['k']=='PT' and t['v']=='[':
                self.advance(); idx=self._parse_expr(); self.eat('PT',']')
                e = {'t':'Index','obj':e,'idx':idx,'line':t['l']}
            elif t['k']=='PT' and t['v']=='(':
                self.advance(); args=[]
                while not self.check(('PT',')')):
                    args.append(self._parse_expr()); self.match('PT',',')
                self.eat('PT',')')
                e = {'t':'Call','func':e,'args':args,'line':t['l']}
            elif t['k']=='OP' and t['v'] in ('++','--'):
                op=self.advance()['v']; e={'t':'PostInc','op':op,'e':e,'line':t['l']}
            else:
                break
        return e

    def _parse_primary(self):
        t = self.peek()
        if t['k']=='NUM':
            self.advance()
            v = float(t['v']) if '.' in t['v'] or 'e' in t['v'].lower() else int(t['v'].rstrip('uUlLfF'))
            return {'t':'Num','v':v,'line':t['l']}
        if t['k']=='STR':
            self.advance(); return {'t':'Str','v':t['v'],'line':t['l']}
        if t['k']=='CHAR':
            self.advance(); return {'t':'Num','v':ord(t['v']),'line':t['l']}
        if t['k']=='KW' and t['v']=='true':
            self.advance(); return {'t':'Bool','v':True,'line':t['l']}
        if t['k']=='KW' and t['v']=='false':
            self.advance(); return {'t':'Bool','v':False,'line':t['l']}
        if t['k']=='KW' and t['v']=='nullptr':
            self.advance(); return {'t':'Null','line':t['l']}
        if t['k']=='KW' and t['v']=='sizeof':
            self.advance(); self.eat('PT','(')
            if self._is_type_start(): self.parse_type()
            else: self._parse_expr()
            self.eat('PT',')'); return {'t':'Num','v':4,'line':t['l']}
        if t['k']=='KW' and t['v']=='new':
            self.advance(); ctype=self.advance()['v']
            # new Type{...}  or new Type(...)
            if self.check(('PT','{')):
                self.advance(); args=[]
                while not self.check(('PT','}')):
                    args.append(self._parse_expr()); self.match('PT',',')
                self.eat('PT','}')
            elif self.check(('PT','(')):
                self.advance(); args=[]
                while not self.check(('PT',')')):
                    args.append(self._parse_expr()); self.match('PT',',')
                self.eat('PT',')')
            else:
                args=[]
            return {'t':'New','ctype':ctype,'args':args,'line':t['l']}
        if t['k']=='PT' and t['v']=='(':
            self.advance(); e=self._parse_expr(); self.eat('PT',')'); return e
        if t['k']=='PT' and t['v']=='{':
            self.advance(); elems=[]
            while not self.check(('PT','}')):
                elems.append(self._parse_expr()); self.match('PT',',')
            self.eat('PT','}')
            return {'t':'InitList','elems':elems,'line':t['l']}
        if t['k'] in ('ID','KW'):
            self.advance(); return {'t':'Ident','name':t['v'],'line':t['l']}
        raise SyntaxError(f"Unexpected token {t['k']}={t['v']!r} at line {t['l']}")

# ──────────────────────────────────────────────────────────────
# INTERPRETER
# ──────────────────────────────────────────────────────────────

class ReturnException(Exception):
    def __init__(self, val): self.val = val

class CppInterpreter:
    MAX_STEPS = 2000

    def __init__(self):
        self.heap = {}          # id -> {id, typeName, fields}
        self.heap_ctr = 0
        self.call_stack = []    # [{name, id, vars, return_val}]
        self.globals = {}
        self.structs = {}       # name -> {fields: [{name,type}]}
        self.funcs = {}         # name -> FuncDecl node
        self.stdout = ''
        self.snapshots = []
        self.step = 0

    def new_id(self):
        self.heap_ctr += 1; return f'h{self.heap_ctr}'

    def alloc(self, type_name, fields):
        hid = self.new_id()
        self.heap[hid] = {'id': hid, 'typeName': type_name.rstrip('*'), 'fields': fields}
        return hid

    # ── environment helpers ──────────────────────────────────
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
            locals_ = {}
            for k, v in f['vars'].items():
                locals_[k] = self._rv_to_value(v)
            frame = {'id': f['id'], 'name': f['name'], 'locals': locals_}
            if 'return_val' in f:
                frame['returnValue'] = self._rv_to_value(f['return_val'])
            stack.append(frame)

        heap = {}
        for hid, obj in self.heap.items():
            attrs = {k: self._rv_to_value(v) for k, v in obj['fields'].items()}
            if obj.get('isArray'):
                heap[hid] = {'kind':'list','id':hid,'items':[self._rv_to_value(e) for e in obj['elems']]}
            else:
                heap[hid] = {'kind':'object','id':hid,'type':obj['typeName'],'attrs':attrs}

        globals_ = {k: self._rv_to_value(v) for k, v in self.globals.items()
                    if not callable(v)}

        self.snapshots.append({
            'step': self.step, 'line': line, 'stack': stack,
            'heap': heap, 'globals': globals_,
            'event': event, 'highlight': None,
            'stdout': self.stdout,
        })
        self.step += 1

    def _rv_to_value(self, rv):
        if rv is None: return {'kind':'none'}
        if isinstance(rv, str) and rv.startswith('__ref__'):
            hid = rv[7:]
            return {'kind':'none'} if hid == 'null' else {'kind':'ref','id':hid}
        if isinstance(rv, bool): return {'kind':'primitive','value':rv}
        if isinstance(rv, (int, float)): return {'kind':'primitive','value':rv}
        if isinstance(rv, str): return {'kind':'primitive','value':rv}
        if isinstance(rv, list):
            hid = self.new_id()
            self.heap[hid] = {'id':hid,'typeName':'array','isArray':True,'elems':rv,'fields':{}}
            return {'kind':'ref','id':hid}
        return {'kind':'none'}

    # ── execution ────────────────────────────────────────────
    def run(self, code):
        toks = _lex(code)
        ast = Parser(toks).parse_program()
        # collect declarations
        for decl in ast['decls']:
            if decl['t'] == 'StructDecl':
                self.structs[decl['name']] = decl
            elif decl['t'] == 'FuncDecl':
                self.funcs[decl['name']] = decl
            elif decl['t'] == 'VarDecl':
                val = self.eval_expr(decl['init']) if decl['init'] else 0
                self.globals[decl['name']] = val
        # run main
        if 'main' not in self.funcs:
            raise RuntimeError('No main() function found')
        self.call_func('main', [])
        return self.snapshots

    def _copy_struct(self, ref):
        """Shallow-copy a heap struct — simulates C++ pass-by-value for structs."""
        if not (isinstance(ref, str) and ref.startswith('__ref__')): return ref
        hid = ref[7:]
        if hid == 'null' or hid not in self.heap: return ref
        orig = self.heap[hid]
        if orig.get('isArray'): return ref  # arrays decay to pointer — no copy
        new_hid = self.new_id()
        self.heap[new_hid] = {
            'id': new_hid,
            'typeName': orig['typeName'],
            'isArray': False,
            'fields': dict(orig['fields']),
        }
        return '__ref__' + new_hid

    def call_func(self, name, arg_vals):
        if name not in self.funcs:
            raise RuntimeError(f"Undefined function '{name}'")
        fn = self.funcs[name]
        frame = {'name': name, 'id': f'frame_{self.heap_ctr}_{name}', 'vars': {}}
        self.heap_ctr += 1
        for p, v in zip(fn['params'], arg_vals):
            ptype = p['type']
            # Struct passed by value (no * or []) → make a copy, like C++ does
            if ('*' not in ptype and '[]' not in ptype and
                    ptype in self.structs and
                    isinstance(v, str) and v.startswith('__ref__') and v != '__ref__null'):
                v = self._copy_struct(v)
            frame['vars'][p['name']] = v
        self.call_stack.append(frame)
        self.snap(fn['line'], 'call')
        try:
            self.exec_block(fn['body'])
        except ReturnException as ret:
            frame['return_val'] = ret.val
            self.snap(fn['line'], 'return')
            self.call_stack.pop()
            return ret.val
        self.call_stack.pop()
        return None

    def exec_block(self, block):
        for stmt in block['stmts']:
            self.exec_stmt(stmt)

    def exec_stmt(self, stmt):
        t = stmt['t']
        if t == 'Block':
            self.exec_block(stmt); return
        if t == 'VarDecl':
            val = self.eval_expr(stmt['init']) if stmt['init'] else self._default(stmt['vtype'])
            self.declare_var(stmt['name'], val)
            self.snap(stmt['line'])
            return
        if t == 'ExprStmt':
            self.eval_expr(stmt['expr'])
            self.snap(stmt['line'])
            return
        if t == 'Cout':
            out = ''
            for arg in stmt['args']:
                if arg.get('t') == 'Endl': out += '\n'
                else: out += self._to_str(self.eval_expr(arg))
            self.stdout += out
            self.snap(stmt['line'])
            return
        if t == 'If':
            self.snap(stmt['line'])
            cond = self.eval_expr(stmt['cond'])
            if cond: self.exec_stmt(stmt['then'])
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
                else:
                    self.eval_expr(stmt['init'])
            while True:
                self.snap(stmt['line'])
                if stmt['cond'] and not self.eval_expr(stmt['cond']): break
                self.exec_stmt(stmt['body'])
                if stmt['update']: self.eval_expr(stmt['update'])
            return
        if t == 'Return':
            val = self.eval_expr(stmt['val']) if stmt['val'] else None
            self.snap(stmt['line'], 'return')
            raise ReturnException(val)

    # ── expression evaluator ─────────────────────────────────
    def eval_expr(self, node):
        if node is None: return None
        t = node['t']

        if t == 'Num':  return node['v']
        if t == 'Str':  return node['v']
        if t == 'Bool': return node['v']
        if t == 'Null': return '__ref__null'

        if t == 'Ident':
            name = node['name']
            if name in self.funcs: return f'__func__{name}'
            return self.get_var(name)

        if t == 'Bin':
            l = self.eval_expr(node['l'])
            r = self.eval_expr(node['r'])
            return self._binop(node['op'], l, r)

        if t == 'Unary':
            op = node['op']
            if op == '!': return not self._truthy(self.eval_expr(node['e']))
            if op == '-': return -self.eval_expr(node['e'])
            if op == '*': # dereference
                ref = self.eval_expr(node['e'])
                if isinstance(ref, str) and ref.startswith('__ref__'):
                    hid = ref[7:]
                    return '__ref__' + hid  # for display, dereference is same ref
                return ref
            if op == '&': return self.eval_expr(node['e'])  # address-of (simplified)
            return self.eval_expr(node['e'])

        if t == 'PreInc':
            val = self.eval_expr(node['e'])
            new_val = (val + 1) if node['op'] == '++' else (val - 1)
            self._assign_to(node['e'], new_val); return new_val

        if t == 'PostInc':
            val = self.eval_expr(node['e'])
            new_val = (val + 1) if node['op'] == '++' else (val - 1)
            self._assign_to(node['e'], new_val); return val

        if t == 'Assign':
            val = self.eval_expr(node['right'])
            if node['op'] != '=':
                old = self.eval_expr(node['left'])
                op_map = {'+=':'+','-=':'-','*=':'*','/=':'/'}
                val = self._binop(op_map[node['op']], old, val)
            self._assign_to(node['left'], val); return val

        if t == 'Index':
            obj = self.eval_expr(node['obj'])
            idx = int(self.eval_expr(node['idx']))
            if isinstance(obj, str) and obj.startswith('__ref__'):
                hid = obj[7:]
                arr_obj = self.heap.get(hid, {})
                if arr_obj.get('isArray'):
                    return arr_obj['elems'][idx]
            return None

        if t == 'Arrow':
            ref = self.eval_expr(node['obj'])
            if isinstance(ref, str) and ref.startswith('__ref__'):
                hid = ref[7:]
                return self.heap[hid]['fields'].get(node['field'])
            return None

        if t == 'Dot':
            obj = self.eval_expr(node['obj'])
            if isinstance(obj, str) and obj.startswith('__ref__'):
                hid = obj[7:]
                return self.heap[hid]['fields'].get(node['field'])
            return None

        if t == 'Call':
            func = node['func']
            fname = func['name'] if func['t'] == 'Ident' else None
            args = [self.eval_expr(a) for a in node['args']]
            if fname:
                return self.call_func(fname, args)
            return None

        if t == 'New':
            ctype = node['ctype']
            args = [self.eval_expr(a) for a in node['args']]
            if ctype in self.structs:
                sdef = self.structs[ctype]
                fields = {}
                for i, f in enumerate(sdef['fields']):
                    fields[f['name']] = args[i] if i < len(args) else self._default(f['type'])
                hid = self.alloc(ctype, fields)
                return '__ref__' + hid
            # fallback: generic object
            hid = self.alloc(ctype, {})
            return '__ref__' + hid

        if t == 'InitList':
            elems = [self.eval_expr(e) for e in node['elems']]
            hid = self.new_id()
            self.heap[hid] = {'id':hid,'typeName':'array','isArray':True,'elems':elems,'fields':{}}
            return '__ref__' + hid

        if t == 'CtorCall':
            ctype = node['ctype'].rstrip('*')
            args = [self.eval_expr(a) for a in node['args']]
            if ctype in self.structs:
                sdef = self.structs[ctype]
                fields = {}
                for i, f in enumerate(sdef['fields']):
                    fields[f['name']] = args[i] if i < len(args) else self._default(f['type'])
                hid = self.alloc(ctype, fields)
                return '__ref__' + hid
            return args[0] if args else 0

        return None

    def _assign_to(self, target, val):
        t = target['t']
        if t == 'Ident':
            self.set_var(target['name'], val)
        elif t == 'Arrow':
            ref = self.eval_expr(target['obj'])
            if isinstance(ref, str) and ref.startswith('__ref__'):
                self.heap[ref[7:]]['fields'][target['field']] = val
        elif t == 'Dot':
            ref = self.eval_expr(target['obj'])
            if isinstance(ref, str) and ref.startswith('__ref__'):
                self.heap[ref[7:]]['fields'][target['field']] = val
        elif t == 'Index':
            ref = self.eval_expr(target['obj'])
            idx = int(self.eval_expr(target['idx']))
            if isinstance(ref, str) and ref.startswith('__ref__'):
                arr_obj = self.heap.get(ref[7:])
                if arr_obj and arr_obj.get('isArray'):
                    arr_obj['elems'][idx] = val
        elif t == 'Unary' and target['op'] == '*':
            # *ptr = val  (pointer dereference assignment)
            ref = self.eval_expr(target['e'])
            if isinstance(ref, str) and ref.startswith('__ref__'):
                # for simple case, store in a special field
                pass  # simplified

    def _binop(self, op, l, r):
        if op == '+': return l + r
        if op == '-': return l - r
        if op == '*': return l * r
        if op == '/':
            if isinstance(l, int) and isinstance(r, int): return l // r if r != 0 else 0
            return l / r if r != 0 else 0
        if op == '%': return l % r if r != 0 else 0
        if op == '==': return l == r
        if op == '!=': return l != r
        if op == '<':  return l < r
        if op == '>':  return l > r
        if op == '<=': return l <= r
        if op == '>=': return l >= r
        if op == '&&': return bool(l) and bool(r)
        if op == '||': return bool(l) or bool(r)
        return 0

    def _truthy(self, v):
        if isinstance(v, str) and v.startswith('__ref__'): return v != '__ref__null'
        return bool(v)

    def _default(self, vtype):
        # Strip pointer/array decorators to get the base type name
        base = vtype.rstrip('*[] ')
        if base in {'int','short','long','unsigned','char','size_t','ptrdiff_t'}: return 0
        if base in {'double','float'}: return 0.0
        if base == 'bool': return False
        if base == 'string': return ''
        # Known struct type — allocate on heap with default field values
        if base in self.structs:
            sdef = self.structs[base]
            hid = self.new_id()
            fields = {f['name']: self._default(f['type']) for f in sdef['fields']}
            self.heap[hid] = {'id': hid, 'typeName': base, 'isArray': False, 'fields': fields}
            return '__ref__' + hid
        return '__ref__null'

    def _to_str(self, v):
        if v is None: return 'null'
        if isinstance(v, bool): return 'true' if v else 'false'
        if isinstance(v, float) and v == int(v): return str(int(v))
        if isinstance(v, str) and v.startswith('__ref__'): return f'[obj]'
        return str(v)

# ──────────────────────────────────────────────────────────────
# ENTRY POINT
# ──────────────────────────────────────────────────────────────

def run_cpp(code):
    interp = CppInterpreter()
    try:
        snaps = interp.run(code)
    except RuntimeError as e:
        snaps = interp.snapshots
        snaps.append({
            'step': interp.step, 'line': 0, 'stack': [], 'heap': {},
            'globals': {}, 'event': 'exception', 'highlight': None,
            'stdout': interp.stdout, 'error': str(e),
        })
    except Exception as e:
        snaps = interp.snapshots
        snaps.append({
            'step': interp.step, 'line': 0, 'stack': [], 'heap': {},
            'globals': {}, 'event': 'exception', 'highlight': None,
            'stdout': interp.stdout, 'error': str(e),
        })
    return json.dumps(snaps)
