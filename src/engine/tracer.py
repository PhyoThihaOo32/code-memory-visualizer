import sys
import json
import types
import io

_snapshots = []
_stdout_buf = []
_step = 0
_heap = {}
_heap_counter = [0]
_seen_ids = {}

def _make_id(obj):
    oid = id(obj)
    if oid not in _seen_ids:
        _heap_counter[0] += 1
        _seen_ids[oid] = f"h{_heap_counter[0]}"
    return _seen_ids[oid]

def _encode_value(v, depth=0):
    if depth > 4:
        return {"kind": "primitive", "value": "..."}
    if v is None:
        return {"kind": "none"}
    if isinstance(v, bool):
        return {"kind": "primitive", "value": v}
    if isinstance(v, (int, float, str)):
        return {"kind": "primitive", "value": v}
    if isinstance(v, (list, tuple)):
        hid = _make_id(v)
        _heap[hid] = {
            "kind": "list",
            "id": hid,
            "items": [_encode_value(item, depth + 1) for item in v]
        }
        return {"kind": "ref", "id": hid}
    if isinstance(v, dict):
        hid = _make_id(v)
        _heap[hid] = {
            "kind": "dict",
            "id": hid,
            "entries": [{"key": str(k), "value": _encode_value(val, depth + 1)} for k, val in list(v.items())[:20]]
        }
        return {"kind": "ref", "id": hid}
    if hasattr(v, '__dict__') and not isinstance(v, type) and not callable(v):
        hid = _make_id(v)
        attrs = {}
        for k, val in list(vars(v).items())[:20]:
            if not k.startswith('_'):
                attrs[k] = _encode_value(val, depth + 1)
        _heap[hid] = {
            "kind": "object",
            "id": hid,
            "type": type(v).__name__,
            "attrs": attrs
        }
        return {"kind": "ref", "id": hid}
    return {"kind": "primitive", "value": repr(v)[:50]}

def _encode_frame(frame):
    locals_enc = {}
    for k, v in frame.f_locals.items():
        if (not k.startswith('_')
                and not isinstance(v, types.ModuleType)
                and not isinstance(v, type)
                and not callable(v)):
            locals_enc[k] = _encode_value(v)
    return {
        "id": str(id(frame)),
        "name": frame.f_code.co_name,
        "locals": locals_enc
    }

_SKIP_FRAMES = {'<module>', '_trace', 'settrace'}

def _trace(frame, event, arg):
    global _step
    fname = frame.f_code.co_filename
    if fname != '<exec_code>' and fname != '<string>':
        return _trace

    func_name = frame.f_code.co_name

    # Build call stack from current frame upward
    stack = []
    f = frame
    frames_visited = []
    while f is not None:
        if (f.f_code.co_filename == '<exec_code>' or f.f_code.co_filename == '<string>'):
            frames_visited.append(f)
        f = f.f_back
    frames_visited.reverse()

    for fr in frames_visited:
        stack.append(_encode_frame(fr))

    # Globals (only user-defined non-callables)
    g_enc = {}
    for k, v in frame.f_globals.items():
        if not k.startswith('_') and not callable(v) and not isinstance(v, types.ModuleType):
            g_enc[k] = _encode_value(v)

    highlight = None
    if event == 'line':
        ev = 'line'
    elif event == 'call':
        ev = 'call'
    elif event == 'return':
        ev = 'return'
        ret_val = _encode_value(arg)
        if stack:
            stack[-1]['returnValue'] = ret_val
    elif event == 'exception':
        ev = 'exception'
    else:
        return _trace

    snap = {
        "step": _step,
        "line": frame.f_lineno,
        "stack": stack,
        "heap": dict(_heap),
        "globals": g_enc,
        "event": ev,
        "highlight": highlight,
        "stdout": sys.stdout.getvalue()   # progressive: only output printed so far
    }
    _snapshots.append(snap)
    _step += 1

    if _step > 2000:
        raise StopIteration("Step limit reached")

    return _trace

def run_and_trace(code):
    global _snapshots, _step, _heap, _seen_ids
    _snapshots = []
    _step = 0
    _heap = {}
    _heap_counter[0] = 0
    _seen_ids = {}
    _stdout_buf.clear()

    old_stdout = sys.stdout
    sys.stdout = io.StringIO()

    try:
        compiled = compile(code, '<exec_code>', 'exec')
        g = {'__name__': '__main__'}
        sys.settrace(_trace)
        try:
            exec(compiled, g)
        except StopIteration:
            pass
        except Exception as e:
            _snapshots.append({
                "step": _step,
                "line": 0,
                "stack": [],
                "heap": {},
                "globals": {},
                "event": "exception",
                "highlight": None,
                "stdout": sys.stdout.getvalue(),
                "error": str(e)
            })
        finally:
            sys.settrace(None)

    finally:
        sys.stdout = old_stdout

    return json.dumps(_snapshots)
