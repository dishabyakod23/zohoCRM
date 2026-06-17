import { getLeadDetailPath } from './pipelineHelpers.js';

const TYPE_PATHS = {
  account: (id) => `/accounts/${id}`,
  contact: (id) => `/contacts/${id}`,
  deal: (id) => `/deals/${id}`,
  task: (id) => `/tasks/${id}`,
  call: (id) => `/calls/${id}`,
  meeting: (id) => `/meetings/${id}`,
  campaign: (id) => `/campaigns/${id}`,
  document: (id) => `/documents/${id}`,
  visit: (id) => `/visits/${id}`,
  project: (id) => `/projects/${id}`,
};

export function getRecentItemHref({ type, id, pipelineStage, lead }) {
  if (type === 'lead') return getLeadDetailPath(lead || pipelineStage, id);
  const build = TYPE_PATHS[type];
  return build ? build(id) : `/${type}s/${id}`;
}
