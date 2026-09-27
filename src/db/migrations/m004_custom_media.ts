import { type Migration } from './types';

/**
 * Owner requests after the UI phase: equipment gets a custom icon or picture (private
 * relative path, AD-13), and photo categories can be user-created groups with a name.
 */
export const m004_custom_media: Migration = {
  id: 4,
  name: 'custom_media',
  statements: [
    'ALTER TABLE equipment ADD COLUMN icon_key TEXT',
    'ALTER TABLE equipment ADD COLUMN image_path TEXT',
    'ALTER TABLE photo_categories ADD COLUMN name TEXT',
  ],
};
