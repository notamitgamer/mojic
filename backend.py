from flask import Flask, request, jsonify
from flask_cors import CORS
import re

app = Flask(__name__)
CORS(app)

@app.route('/')
def home():
    return "Emojic Compiler API is Running!"

@app.route('/api/compile', methods=['POST'])
def compile_emojic():
    """
    Transpiles Emojic -> C
    This parses the #define macros present in the source code itself.
    """
    data = request.json
    source_code = data.get('code', '')

    if not source_code:
        return jsonify({"error": "No code provided"}), 400

    mapping = {}
    # Regex to find #define EMOJI REPLACEMENT
    define_pattern = re.compile(r'#define\s+(\S+)\s+(.+)')
    
    lines = source_code.splitlines()
    code_lines = []
    
    # Pass 1: Extract mappings and separate code
    for line in lines:
        match = define_pattern.match(line.strip())
        if match:
            # group(1) is the Emoji, group(2) is the C replacement
            mapping[match.group(1)] = match.group(2).strip()
        else:
            code_lines.append(line)

    translated_code = "\n".join(code_lines)
    
    # Sort keys by length descending to prevent partial replacements
    sorted_keys = sorted(mapping.keys(), key=len, reverse=True)
    
    # Pass 2: Replace emojis with C code
    for key in sorted_keys:
        translated_code = translated_code.replace(key, mapping[key])

    # Ensure standard header is present if logic needs it
    header = "#include <stdio.h>\n"
    if "#include" not in translated_code and "printf" in translated_code:
        translated_code = header + translated_code

    return jsonify({
        "status": "success",
        "c_code": translated_code,
        "message": "Transpilation successful."
    })

@app.route('/api/analyze', methods=['POST'])
def analyze_code():
    """
    Scans C code and returns a list of tokens (keywords, symbols) 
    that are candidates for Emojification.
    """
    data = request.json
    c_code = data.get('code', '')

    if not c_code:
        return jsonify({"error": "No code provided"}), 400

    # Define what we consider "interesting" tokens
    # 1. Keywords
    keywords_regex = r'\b(int|float|char|double|void|return|if|else|while|for|main|printf|scanf|include|define|struct)\b'
    # 2. Common Operators/Symbols
    symbols_regex = r'([\{\}\(\)\;\"\#\<\>])' # Captures { } ( ) ; " # < >

    found_tokens = set()

    # Find keywords
    for match in re.finditer(keywords_regex, c_code):
        found_tokens.add(match.group(1))

    # Find symbols
    for match in re.finditer(symbols_regex, c_code):
        found_tokens.add(match.group(1))

    # Sort them for neat display (longer first usually looks better for mapping, or alphabetical)
    # Here we just sort alphabetically for the UI list
    sorted_tokens = sorted(list(found_tokens))

    return jsonify({
        "status": "success",
        "tokens": sorted_tokens
    })

@app.route('/api/transform', methods=['POST'])
def transform_to_emojic():
    """
    Transforms C -> Emojic using a User-Provided Mapping.
    """
    data = request.json
    c_code = data.get('code', '')
    user_map = data.get('mapping', {}) # Expects { "int": "😒", ... }
    
    if not c_code:
        return jsonify({"error": "No code provided"}), 400
    if not user_map:
        return jsonify({"error": "No mapping provided"}), 400

    # Generate the #define block
    # Note: user_map is { "C_Token": "Emoji" }
    header_block = ""
    
    # Filter out empty mappings
    active_map = {k: v for k, v in user_map.items() if v and v.strip()}

    for c_key, emoji_val in active_map.items():
        # Skip special handling for now, just direct defines
        if c_key == "#": continue # defines for # are tricky
        header_block += f"#define {emoji_val} {c_key}\n"
    
    header_block += "\n"
    
    # Sort by length of C keyword to avoid replacing substrings incorrectly
    sorted_c_keys = sorted(active_map.keys(), key=len, reverse=True)
    
    transformed_body = c_code
    for c_key in sorted_c_keys:
        # Use regex to replace only whole words if it's a word, or literal if it's a symbol
        if c_key.isalnum():
            # \b matches word boundary
            pattern = r'\b' + re.escape(c_key) + r'\b'
            transformed_body = re.sub(pattern, active_map[c_key], transformed_body)
        else:
            transformed_body = transformed_body.replace(c_key, active_map[c_key])

    final_output = header_block + transformed_body

    return jsonify({
        "status": "success",
        "emojic_code": final_output
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
