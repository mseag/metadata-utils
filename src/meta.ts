import chalk from 'chalk';
import { exiftool, parseJSON, Tags, WriteTags } from 'exiftool-vendored';
import path from 'path';

// Utilities to read and write metadata tags from an image file.
// Currently, we are interested in {creator, license, rights}

export default {getTags, writeImageTags};

export type fileType =
  "audio" | "image";

// Default creative commons license
export const DEFAULT_LICENSE_CC_BY_NC_SA = "https://creativecommons.org/licenses/by-nc-sa/4.0/";

export interface linkedFileType {
  fileName: string;
  fileType: fileType;

  // primary fields of the tags we care about
  sourceFile: string | undefined;
  creator: string | undefined;
  license: string | undefined;
  rights: string | undefined;

  // All the tags
  tags?: Tags;
}

// The fields of the XMP metadata tag we care about
export interface xmpTagType {
  'XMP:Creator'? : string;
  'XMP:License'? : string;
  'XMP:Rights'? : string;
}

chalk.level = 1; // Use colors in the VS Code Debug Window

/**
 * Retrieve the metadata tags from a list of files
 * @param files {string[]} - Path to image files
 * @returns - Object of file id to linkedFileType
 */
export async function getTags(files: string[]) : Promise<Object> {
  const promises : Array<Promise<any>> = [];
  files.forEach((file) => {
    promises.push(exiftool.readRaw(file, ['all', '-xmp:all']));
  });

  let linkedFiles = {};
  const allTags = await Promise.all(promises);
  allTags.forEach(rawTags => {
    const str: string = JSON.stringify(rawTags);
    const tags: any = parseJSON(str) as any;
    const id = path.basename(tags.SourceFile);
    linkedFiles[id] = {
      fileName: id,
      fileType: "image",

      sourceFile: tags.SourceFile,
      creator: tags.Creator,
      license: tags.License,
      rights: tags.Rights,

      // Uncomment if we want more metadata tags
      //tags: tags
    };
  });

  return linkedFiles;
}



/**
 * Get the current metadata tags from a list of image files. Then update
 * the tags we care about
 * @param files {string[]} - path to image files
 * @param newTags {Object} - JSON Object of metadata tags
 * @returns string[] - logs of tags that were modified
 */
export async function writeImageTags(files: string[], newTags: any) : Promise<string[]>{
  const fileTags = await getTags(files);
  const promises : Array<Promise<any>> = [];
  const modified : string[] = [];

  for (const [id, currentTags] of Object.entries(fileTags)) {
    const tagToWrite : xmpTagType = {};
    // Update creator info
    if (newTags.hasOwnProperty('creator')) {
      if (currentTags.creator != newTags.creator) {
        const warning = `WARNING: Overwriting ${path.basename(currentTags.fileName)} ` +
          `existing creator: ${currentTags.creator} with ${newTags.creator}`;
        modified.push(warning);
        console.log(chalk.red(warning));
      }

      tagToWrite['XMP:Creator'] = newTags.creator;
    }

    // Update License info
    if (newTags.hasOwnProperty('license')) {
      if (currentTags.license != newTags.license) {
        const warning = `WARNING: Overwriting ${path.basename(currentTags.fileName)} ` +
          `existing license: ${currentTags.license} with ${newTags.license}`;
        modified.push(warning);
        console.log(chalk.red(warning));
      }

      tagToWrite['XMP:License'] = newTags.license;
    }

    // Update Rights info
    if (newTags.hasOwnProperty('rights')) {
      if (currentTags.rights != newTags.rights) {
        const warning = `WARNING: Overwriting ${path.basename(currentTags.fileName)} ` +
          `existing rights: ${currentTags.rights} with ${newTags.rights}`;
        modified.push(warning);
        console.log(chalk.red(warning));
      }

      tagToWrite['XMP:Rights'] = newTags.rights;
    }

    // If tagToWrite has content, add it to the promises to write
    if (Object.keys(tagToWrite).length != 0) {
      promises.push(
        exiftool.write(currentTags.sourceFile as string, //files[index],
          tagToWrite as WriteTags,
          ['-overwrite_original']));
    }
  };

  await Promise.all(promises)
   .catch((error) => {
    console.error(error.message);
   });

  return modified;
}
