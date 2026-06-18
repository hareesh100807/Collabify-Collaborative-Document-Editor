import Version from "../models/VersionModel.js";

export const getContentSignature = (content) => {
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

export const createVersionIfChanged = async ({ documentId, content, editedBy, saveId }) => {
  if (saveId) {
    try {
      return await Version.findOneAndUpdate(
        { saveId },
        {
          $setOnInsert: {
            documentId,
            content,
            editedBy,
            saveId,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if (error?.code === 11000) {
        return Version.findOne({ saveId });
      }
      throw error;
    }
  }

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
