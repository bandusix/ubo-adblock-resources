/*******************************************************************************

    Fixture module shaped like uBlock Origin's resources/base.js.
    Copyright (C) 2019-present Example Author

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

*/

export const registeredScriptlets = [];

export const registerScriptlet = (fn, details) => {
    if ( typeof details !== 'object' ) {
        throw new ReferenceError('Missing scriptlet details');
    }
    details.fn = fn;
    fn.details = details;
    registeredScriptlets.push(details);
};
