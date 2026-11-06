/**
 * Barrel for the shared layer.
 *
 * Shared code is environment-agnostic: it knows nothing about Shipmondo
 * selectors or about devices. It provides the vocabulary (tags, titles,
 * policy, paths) that the mobile layer and the specs are built from.
 */
export * from './assertions';
export * from './env';
export * from './expect';
export * from './generators';
export * from './mocha';
export * from './paths';
export * from './policy';
export * from './tags';
export * from './titles';
