// Code imported from main code base and exposed as injectable scriptlets
import { ArglistParser as __ArglistParser__ } from '../arglist-parser.js';
import { registerScriptlet } from './base.js';

export const ArglistParser = __ArglistParser__;

registerScriptlet(ArglistParser, {
    name: 'arglist-parser.fn',
});
