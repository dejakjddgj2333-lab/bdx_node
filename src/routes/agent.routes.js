const Router = require('koa-router')
const agentController = require('../controllers/agent.controller')
const { auth, optionalAuth } = require('../middleware/auth')

const router = new Router()

router.get('/agents', optionalAuth, agentController.getAgents)
router.get('/agents/:id', optionalAuth, agentController.getAgentDetail)
router.post('/agents', auth, agentController.createAgent)
router.put('/agents/:id', auth, agentController.updateAgent)
router.delete('/agents/:id', auth, agentController.deleteAgent)

module.exports = router
