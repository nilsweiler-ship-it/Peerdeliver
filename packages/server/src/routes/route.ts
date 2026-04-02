import { Router } from 'express';
import { createRouteSchema } from '@peerdeliver/shared';
import * as routeController from '../controllers/route';
import { authenticate, requireRole, validate } from '../middleware';

const router = Router();

router.use(authenticate);
router.post('/', requireRole('driver'), validate(createRouteSchema), routeController.create);
router.get('/mine', requireRole('driver'), routeController.getMine);
router.get('/search', routeController.search);
router.get('/:id', routeController.getById);
router.patch('/:id/active', requireRole('driver'), routeController.toggleActive);
router.delete('/:id', requireRole('driver'), routeController.remove);

export default router;
