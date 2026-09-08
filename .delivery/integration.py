"""Keep concurrent binary API entry points intact while integrating structured IL models."""
RENAMES = {
    'packages/managed-pe/index.js': 'packages/managed-pe/structured.js',
    'packages/managed-pe/tables.js': 'packages/managed-pe/metadata-schema.js',
    'packages/msil-compiler/index.js': 'packages/msil-compiler/verified.js',
    'packages/msil-compiler/opcodes.js': 'packages/msil-compiler/instruction-set.js',
    'packages/msil-compiler/verify.js': 'packages/msil-compiler/verification.js',
}


def integrate(name, text):
    text = text.replace('managed-pe/index.js', 'managed-pe/structured.js')
    text = text.replace('msil-compiler/index.js', 'msil-compiler/verified.js')
    text = text.replace('msil-compiler/opcodes.js', 'msil-compiler/instruction-set.js')
    text = text.replace('msil-compiler/verify.js', 'msil-compiler/verification.js')
    if name.startswith('packages/managed-pe/'):
        text = text.replace("'./tables.js'", "'./metadata-schema.js'")
    if name.startswith('packages/msil-compiler/'):
        text = text.replace("'./opcodes.js'", "'./instruction-set.js'")
        text = text.replace("'./verify.js'", "'./verification.js'")
    return RENAMES.get(name, name), text
