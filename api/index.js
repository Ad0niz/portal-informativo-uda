import { cloudHandler } from '../lib/cloud.mjs';
import { accountHandler, handlesAccountRequest } from '../lib/accounts.mjs';

// This entry point never loads the local JSON database or local credentials.
export default {
  async fetch(request) {
    if (handlesAccountRequest(request)) return accountHandler(request);
    return cloudHandler(request);
  }
};
