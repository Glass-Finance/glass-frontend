import client from "./client";

// Browser-generated boundaries are required. `false` clears the shared JSON
// default without forcing Axios to invent a multipart boundary for FormData.
export const uploadFile = (file, fileCategory) => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("fileCategory", fileCategory);
  return client.post("/file/upload", fd, { headers: { "Content-Type": false } });
};

export const uploadFiles = (files, fileCategory) => {
  const fd = new FormData();
  files.forEach((file) => fd.append("files", file));
  fd.append("fileCategory", fileCategory);
  return client.post("/file/upload/multiple", fd, { headers: { "Content-Type": false } });
};
