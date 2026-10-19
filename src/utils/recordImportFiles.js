export function isFileDrag(event) {
  return (
    Array.from(event.dataTransfer?.types ?? []).includes("Files") ||
    !!event.dataTransfer?.files?.length
  );
}

export function validateRecordImportFiles(files) {
  const invalid = files.find(
    (file) => !/\.(csv|tsv|xlsx|xls)$/i.test(file.name) || file.size > 25 * 1024 * 1024,
  );
  return invalid ? `${invalid.name}: choose a supported spreadsheet no larger than 25 MiB.` : "";
}
