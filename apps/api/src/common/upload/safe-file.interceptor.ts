/**
 * Prefer FileInterceptor(multerMemoryOptions(kind)) + FileSecurityService.assertSafe
 * in the service layer — more reliable than nested interceptors.
 *
 * Kept as a pointer for Stage 24 docs.
 */
export { multerMemoryOptions } from './multer-options';
export { FileSecurityService } from './file-security.service';

