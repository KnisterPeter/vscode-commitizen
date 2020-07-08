module.exports = {
  mergeStrategy: { toSameBranch: ["master"] },
  buildCommand: ({}) => null,
  publishCommand: () => "yarn publish-extension",
};
