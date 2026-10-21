import { Download, FileSpreadsheet, Check, X } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import uploadCloudIcon from "../../../assets/icons/upload-cloud.webp";
import { HEADERS, SAMPLE_ROW, downloadTemplate } from "../addMembersUtils";

// Extracted from AddMembers() as a pure presentational piece -- all state
// and handlers still live in the parent and come in as props, same shape
// as SuccessModal above. Kept as an explicit flat prop list (rather than
// a bundled object) so each prop maps 1:1 to the variable it replaced,
// making this a mechanical extraction with no behavior change.
export default function UploadMembersTab({
  uploadedFile,
  dragOver,
  setDragOver,
  fileRef,
  handleFile,
  handleDrop,
  fileUrl,
  setFileUrl,
  urlStage,
  urlProgress,
  urlFileInfo,
  handleUrlUpload,
  clearUrlUpload,
  loading,
  error,
  inputCls,
}) {
  return (
    <>
      <p className="text-sm font-semibold text-gray-900 mb-4">Upload a CSV</p>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 mb-4">
        <p className="text-sm text-gray-500">Upload a CSV file with following sample information</p>
        <Button variant="tertiary" size="xs" fullWidth={false} onClick={downloadTemplate}>
          <Download size={12} />
          Download Template
        </Button>
      </div>

      {/* Sample table — wider than any phone viewport, so it
          scrolls in its own strip instead of squeezing columns
          down to illegible widths. */}
      <div className="rounded-md overflow-x-auto mb-4 border border-hairline-neutral">
        <table className="w-full text-xs min-w-[560px]">
          <thead>
            <tr className="bg-gray-50">
              {HEADERS.map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-100">
              {SAMPLE_ROW.map((cell, i) => (
                <td
                  key={i}
                  className={`px-4 py-3 ${i === 2 ? "text-brand underline" : "text-gray-900"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`w-full rounded-lg flex flex-col items-center justify-center py-8 cursor-pointer transition-all mb-5 min-h-[100px] border-dashed ${dragOver ? "border-2 bg-brand-wash border-brand" : "border bg-surface-page border-gray-200"}`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          aria-label="Upload members CSV file"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
        <img src={uploadCloudIcon} alt="" className="w-6 h-6 mb-2" loading="lazy" />
        {uploadedFile ? (
          <p className="text-xs text-brand font-medium">{uploadedFile.name}</p>
        ) : (
          <p className="text-xs text-gray-500">
            Drag and Drop CSV here or{" "}
            <span className="text-brand font-medium underline">Browse</span>
          </p>
        )}
      </div>

      {/* URL upload */}
      <div>
        <p className="text-xs font-medium text-gray-700 mb-2">Or Upload from URL</p>
        <div className="flex gap-2">
          <input
            type="url"
            aria-label="CSV file URL"
            value={fileUrl}
            onChange={(e) => {
              setFileUrl(e.target.value);
              if (urlStage !== "idle") clearUrlUpload();
            }}
            placeholder="Add File URL"
            className={inputCls}
            disabled={urlStage === "fetching"}
          />
          <Button
            variant="outline"
            size="sm"
            fullWidth={false}
            onClick={handleUrlUpload}
            disabled={!fileUrl.trim() || urlStage === "fetching" || loading}
            className="flex-shrink-0"
          >
            Upload
          </Button>
        </div>

        {urlStage === "fetching" && (
          <div className="mt-3 flex items-center gap-3 rounded-lg px-4 py-3 border border-hairline-neutral">
            <FileSpreadsheet size={20} className="text-gray-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-900 truncate">
                {fileUrl.split("/").pop() || "file.csv"}
              </p>
              <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-200 ease-linear"
                  style={{ width: `${urlProgress}%` }}
                />
              </div>
            </div>
            <span className="text-xs text-gray-500 flex-shrink-0">{Math.round(urlProgress)}%</span>
            <Button
              variant="tertiary"
              size="icon-sm"
              aria-label="Cancel upload"
              onClick={clearUrlUpload}
              className="flex-shrink-0"
            >
              <X size={16} />
            </Button>
          </div>
        )}

        {urlStage === "complete" && urlFileInfo && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg px-4 py-3 border border-hairline-neutral">
            <FileSpreadsheet size={20} className="text-success flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-900 truncate">{urlFileInfo.name}</p>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                {urlFileInfo.sizeLabel} • <Check size={11} className="text-success" />{" "}
                <span className="text-success font-medium">Complete</span>
              </p>
            </div>
            <Button
              variant="tertiary"
              size="icon-sm"
              aria-label="Remove file"
              onClick={clearUrlUpload}
              className="flex-shrink-0"
            >
              <X size={16} />
            </Button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-danger mt-3">{error}</p>}
    </>
  );
}
