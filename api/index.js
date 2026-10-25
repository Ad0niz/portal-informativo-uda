import { cloudHandler } from '../lib/cloud.mjs';

// This entry point never loads the local JSON database or local credentials.
export default { fetch: cloudHandler };
