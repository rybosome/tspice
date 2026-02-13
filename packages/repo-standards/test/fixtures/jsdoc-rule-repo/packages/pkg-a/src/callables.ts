/** withDoc has doc */
export function withDoc() {}

export function missingDoc() {}

/**
*
*/
export function emptyDoc() {}

/** blankLineOk has doc */

export function blankLineOk() {}

/** commentBetween has doc */
// this comment invalidates the JSDoc
export function commentBetween() {}

/** arrowWithDoc has doc */
export const arrowWithDoc = () => {};

export const arrowMissingDoc = () => {};

/** fnExprWithDoc has doc */
export const fnExprWithDoc = function () {};

export const fnExprMissingDoc = function () {};
