/**
 * File storage barrel. Import from here rather than reaching into the
 * individual files so future changes (e.g. moving to MinIO, adding a
 * local filesystem fallback) can happen in one place.
 */

export {
  getR2Config,
  buildObjectKey,
  putObject,
  deleteObject,
  rawObjectUrl,
  type R2Config,
  type UploadKind,
} from "./r2-client";

export {
  imgproxyUrl,
  imgpreset,
  type ImgproxyTransform,
} from "./imgproxy";
