import crypto from 'node:crypto';

export const createTicketId = (sourceId: string, url: string, title: string) => {
  const hash = crypto.createHash('sha256');
  hash.update(`${sourceId}|${url}|${title}`);
  return hash.digest('hex');
};
