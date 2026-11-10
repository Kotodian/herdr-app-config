"""Read-only, credential-free presentation of Magpie's existing library."""
import json
import re
import sys
from pathlib import Path

ROOT = Path.home() / '.config/magpie'

def load():
    return json.loads((ROOT / 'library.json').read_text())

def skill_path(name):
    if not name or '/' in name or '\\' in name or name in {'.', '..'}:
        raise ValueError('Invalid skill name')
    return ROOT / 'library/skills' / name / 'SKILL.md'

def description(path):
    try:
        text = path.read_text()
        match = re.search(r'^description:\s*(.+)$', text, re.M)
        if match:
            value = match[1].strip().strip('"\'')
            return value if value not in {'>', '|', '>-', '|-'} else ''
    except OSError:
        pass
    return ''

def catalog(data):
    skills = []
    for s in data.get('skills', []):
        name = s.get('name', '')
        try:
            path = skill_path(name)
            skills.append({'name': name, 'agents': s.get('agents', []),
                           'description': description(path), 'available': path.is_file(),
                           'source': s.get('source', '') if isinstance(s.get('source', ''), str) else ''})
        except ValueError:
            continue
    # Deliberate allow-list: never forward MCP headers, env, auth, or command arguments.
    mcp = [{'name': s.get('name', ''), 'agents': s.get('agents', []),
            'description': '远程 MCP' if s.get('transport') in {'http', 'sse', 'streamable-http'} or s.get('url') else '本机 MCP',
            'available': True} for s in data.get('mcp', [])]
    subagents = [{'name': s.get('name', ''), 'agents': s.get('agents', []),
                  'description': s.get('description', ''), 'available': True}
                 for s in data.get('subagents', [])]
    ins = data.get('instructions', {})
    sets = ins.get('sets', [])
    instructions = [{'name': s.get('name', s.get('id', str(i))),
                     'agents': s.get('agents', ins.get('agents', [])),
                     'description': '共享指令', 'available': True,
                     'active': s.get('id', s.get('name')) == ins.get('active')}
                    for i, s in enumerate(sets) if isinstance(s, dict)]
    return {'skills': sorted(skills, key=lambda s:s['name'].lower()), 'mcp': mcp,
            'subagents': subagents, 'instructions': instructions}

def detail(data, kind, name):
    if kind == 'skills':
        if not any(s.get('name') == name for s in data.get('skills', [])):
            raise ValueError('Skill is no longer in the library')
        return {'text': skill_path(name).read_text(), 'path': str(skill_path(name))}
    if kind == 'subagents':
        item = next(s for s in data.get('subagents', []) if s.get('name') == name)
        return {'text': item.get('prompt', ''), 'path': ''}
    if kind == 'instructions':
        item = next(s for i,s in enumerate(data.get('instructions',{}).get('sets',[]))
                    if s.get('name',s.get('id',str(i))) == name)
        return {'text': item.get('text', item.get('content', '')), 'path': ''}
    raise ValueError('Unsupported resource kind')

try:
    data = load()
    result = detail(data, sys.argv[1], sys.argv[2]) if len(sys.argv) == 3 else catalog(data)
    print(json.dumps(result, ensure_ascii=False))
except Exception as error:
    print(json.dumps({'error': str(error)}, ensure_ascii=False))
    sys.exit(1)
