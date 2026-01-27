from flask import Flask, request, jsonify
from flask_cors import CORS
import re

app = Flask(__name__)
# Allow CORS for all domains so your frontend works everywhere
CORS(app, resources={r"/api/*": {"origins": "*"}})

@app.route('/')
def home():
    return "Emojic Compiler API is Running! (v1.1)"

@app.route('/api/compile', methods=['POST', 'OPTIONS'])
def compile_emojic():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data = request.json
    source_code = data.get('code', '')

    if not source_code:
        return jsonify({"error": "No code provided"}), 400

    mapping = {}
    define_pattern = re.compile(r'#define\s+(\S+)\s+(.+)')
    
    lines = source_code.splitlines()
    code_lines = []
    
    for line in lines:
        match = define_pattern.match(line.strip())
        if match:
            mapping[match.group(1)] = match.group(2).strip()
        else:
            code_lines.append(line)

    translated_code = "\n".join(code_lines)
    sorted_keys = sorted(mapping.keys(), key=len, reverse=True)
    
    for key in sorted_keys:
        translated_code = translated_code.replace(key, mapping[key])

    header = "#include <stdio.h>\n"
    if "#include" not in translated_code and "printf" in translated_code:
        translated_code = header + translated_code

    return jsonify({
        "status": "success",
        "c_code": translated_code,
        "message": "Transpilation successful."
    })

@app.route('/api/analyze', methods=['POST', 'OPTIONS'])
def analyze_code():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data = request.json
    c_code = data.get('code', '')

    if not c_code:
        return jsonify({"error": "No code provided"}), 400

    keywords_regex = r'\b(int|float|char|double|void|return|if|else|while|for|main|printf|scanf|include|define|struct)\b'
    symbols_regex = r'([\{\}\(\)\;\"\#\<\>])' 

    found_tokens = set()

    for match in re.finditer(keywords_regex, c_code):
        found_tokens.add(match.group(1))

    for match in re.finditer(symbols_regex, c_code):
        found_tokens.add(match.group(1))

    sorted_tokens = sorted(list(found_tokens))

    return jsonify({
        "status": "success",
        "tokens": sorted_tokens
    })

@app.route('/api/transform', methods=['POST', 'OPTIONS'])
def transform_to_emojic():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    data = request.json
    c_code = data.get('code', '')
    user_map = data.get('mapping', {}) 
    
    if not c_code:
        return jsonify({"error": "No code provided"}), 400

    header_block = ""
    active_map = {k: v for k, v in user_map.items() if v and v.strip()}

    for c_key, emoji_val in active_map.items():
        if c_key == "#": continue 
        header_block += f"#define {emoji_val} {c_key}\n"
    
    header_block += "\n"
    
    sorted_c_keys = sorted(active_map.keys(), key=len, reverse=True)
    
    transformed_body = c_code
    for c_key in sorted_c_keys:
        if c_key.isalnum():
            pattern = r'\b' + re.escape(c_key) + r'\b'
            transformed_body = re.sub(pattern, active_map[c_key], transformed_body)
        else:
            transformed_body = transformed_body.replace(c_key, active_map[c_key])

    final_output = header_block + transformed_body

    return jsonify({
        "status": "success",
        "emojic_code": final_output
    })

# Expose app for Vercel
app = app
