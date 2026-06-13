import Version from "../models/VersionModel.js";

const getContentSignature = (content) => {
  try {
    return JSON.stringify(content ?? null);
  } catch {
    return String(content ?? "");
  }
};

export const filterDuplicateVersions = (versions = []) => {
  const filteredVersions = [];
  let previousSignature = null;

  versions.forEach((version) => {
    const signature = getContentSignature(version.content);
    if (signature === previousSignature) return;

    filteredVersions.push(version);
    previousSignature = signature;
  });

  return filteredVersions;
};

export const createVersionIfChanged = async ({ documentId, content, editedBy }) => {
  const latestVersion = await Version.findOne({ documentId }).sort({ createdAt: -1 }).select("content");

  if (latestVersion && getContentSignature(latestVersion.content) === getContentSignature(content)) {
    return latestVersion;
  }

  return Version.create({
    documentId,
    content,
    editedBy,
  });
};
