// SPDX-License-Identifier: GPL-3.0-or-later
// Bump when the conversion logic changes in a way that can change the output for the same upstream files
// (the incremental check in cli.mjs treats a different version as "must re-convert").
export const CONVERTER_NAME = 'ubo-resources-converter';
export const CONVERTER_VERSION = '1.0.0';
export const OUTPUT_FILE = 'ubo-resources.json';
export const META_FILE = 'ubo-resources.meta.json';
export const META_SCHEMA = 1;
