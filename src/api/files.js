import client from "./client";

// POST /api/v1/file/upload — multipart, fileCategory ∈
// PROFILE_IMAGE | COMMUNITY_LOGO | COMMUNITY_BRANDING_ASSET
export const uploadFile = (file, fileCategory) => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("fileCategory", fileCategory);
  return client.post("/file/upload", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

// POST /api/v1/file/upload/multiple — multipart, same fileCategory enum, but
// the part name is "files" (plural) to match the backend's List<MultipartFile>
// binding. Part order is irrelevant; fileCategory binds as a @ModelAttribute
// field, so it can ride in the same body.
//
// The backend answers 201 even when some of the files were rejected: it loops
// the batch and reports each outcome in the body rather than failing the
// request. Callers therefore have to inspect per-entry `success` — see
// useFileUploadMultiple, which does that split once for all of them.
export const uploadFiles = (files, fileCategory) => {
  const fd = new FormData();
  for (const file of files) fd.append("files", file);
  fd.append("fileCategory", fileCategory);
  return client.post("/file/upload/multiple", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
