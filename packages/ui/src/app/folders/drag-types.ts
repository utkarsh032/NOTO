/**
 * Drag payload types for the sidebar. Custom types rather than `text/plain`,
 * so a document dragged out of Noto into another application does not arrive
 * there as a bare id, and text dragged into Noto is never mistaken for one.
 */
export const DOCUMENT_DRAG_TYPE = 'application/x-noto-document';
export const FOLDER_DRAG_TYPE = 'application/x-noto-folder';
