import client from "./client";

// Browser/OS MIME databases may report spreadsheets as empty, octet-stream,
// or ZIP. Supply the declared type required by RECORD_IMPORT_SOURCE, preserving
// the original bytes/name. The backend independently verifies signatures with
// Tika; this metadata normalization does not relax content validation.
function sourceFile(file, category) {
  if (category !== "RECORD_IMPORT_SOURCE") return file;
  const extension = file.name.split(".").pop()?.toLowerCase();
  const types = {
    csv: "text/csv",
    tsv: "text/tab-separated-values",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  const type = types[extension ?? ""];
  return type && file.type !== type
    ? new File([file], file.name, { type, lastModified: file.lastModified })
    : file;
}

// Browser-generated boundaries are required. `false` clears the shared JSON
// default without forcing Axios to invent a multipart boundary for FormData.
export const uploadFile = (file, fileCategory) => {
  const fd = new FormData();
  fd.append("file", sourceFile(file, fileCategory));
  fd.append("fileCategory", fileCategory);
  return client.post("/file/upload", fd, { headers: { "Content-Type": false } });
};

export const uploadFiles = (files, fileCategory) => {
  const fd = new FormData();
  files.forEach((file) => fd.append("files", sourceFile(file, fileCategory)));
  fd.append("fileCategory", fileCategory);
  return client.post("/file/upload/multiple", fd, { headers: { "Content-Type": false } });
};
