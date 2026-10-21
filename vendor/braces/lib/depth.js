'use strict';

// Bound every recursive AST walker, including direct AST entry points.
module.exports = depth => {
  if (depth > 128) {
    const error = new SyntaxError('Brace pattern exceeds maximum AST depth (128)');
    error.code = 'ERR_BRACES_DEPTH';
    throw error;
  }
};
