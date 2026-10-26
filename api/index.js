import { cloudHandler } from '../lib/cloud.mjs';
import { accountHandler, handlesAccountRequest } from '../lib/accounts.mjs';
import { enforcePasswordChange, handlesPasswordRequest, passwordHandler } from '../lib/password.mjs';

// This entry point never loads the local JSON database or local credentials.
export default {
  async fetch(request) {
    if (handlesPasswordRequest(request)) return passwordHandler(request);
    const passwordBlock = await enforcePasswordChange(request);
    if (passwordBlock) return passwordBlock;
    if (handlesAccountRequest(request)) return accountHandler(request);
    return cloudHandler(request);
  }
};
