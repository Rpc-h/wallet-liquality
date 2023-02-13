import { getSignClient } from '@/utils/wallet-connect'
import { notify } from '@/utils/notification'
import { DappProviderFactory } from '@/dapps/DappProviderFactory'
import qs from 'qs'

let clientInitialized = false

export const initializeSignClient = async ({ state, dispatch, rootGetters }) => {
  const signClient = await getSignClient()
  if (!clientInitialized) {
    signClient.on('session_proposal', async ({ id, params }) => {
      console.log('session_proposal', { id, params })
      dispatch('getSessionProposals')
      const notificationId = `session-proposal:${params.pairingTopic}`
      notify(
        {
          notificationId,
          options: {
            title: 'Wallet Connect Session',
            message: 'You have a new session request'
          }
        },
        (id) => {
          if (id === notificationId) {
            if (state.app.extensionIsOpen === true) {
              //dispatch('showWalletNotification')
            } else {
              dispatch('openWalletConnectTab', { session: id.replace('session-proposal:', '') })
            }
          }
        }
      )
    })

    signClient.on('session_event', (event) => {
      console.log('session_event', event)
    })

    signClient.on('session_request', async ({ id, topic, params }) => {
      console.log('session_request', { id, topic, params })
      const { chainId, request } = params
      const { networkAccounts } = rootGetters
      const { wcSessions } = state
      // TODO : validate namespace / chainId with network => eip155:5
      const namespace = chainId.split(':')[0]
      const { namespaces } = wcSessions.find((s) => s.namespaces[namespace] && s.topic === topic)
      const { accounts } = namespaces[namespace]
      const wcAccounts = accounts.map((a) => a.replace(`${chainId}:`, ''))
      // TODO : validate with chainId map ex: eip155 => ethereum / 5 => testnet
      const account = networkAccounts.find(
        (a) => a.chain === 'ethereum' && wcAccounts.some((r) => a.addresses.includes(r))
      )
      // => 1: store the request in state
      
      // => 2: wait for the reponse
      const provider = DappProviderFactory.resolve({ chainId })
      const result = await provider.handleRequest({ ...request, chainId, accountId: account.id })
      const response = { id, result, jsonrpc: '2.0' }
      const respond = await signClient.respond({ topic, response })
      console.log('session_request => respond', respond)
      await (await signClient.extend({ topic })).acknowledged()
    })

    signClient.on('session_ping', ({ id, topic }) => {
      console.log('WalletConnect: session_ping', { id, topic })
    })

    signClient.on('session_delete', ({ id, topic }) => {
      console.log('WalletConnect: session_delete', { id, topic })
      dispatch('getSessions')
    })

    // TODO: check when these events are called and how to handle it inside the wallet data
    signClient.core.pairing.events.on('pairing_delete', ({ id, topic }) => {
      console.log('pairing_delete', { id, topic })
      dispatch('getPairings')
    })
    signClient.core.pairing.events.on('pairing_ping', ({ id, topic }) => {
      console.log('pairing_ping', { id, topic })
    })
    signClient.core.pairing.events.on('pairing_expire', ({ id, topic }) => {
      console.log('pairing_expire', { id, topic })
      dispatch('getPairings')
    })
    clientInitialized = true
  }
  //initialize data
  dispatch('getPairings')
  dispatch('getSessions')
  dispatch('getSessionProposals')
}

export const getPairings = async ({ commit }) => {
  const signClient = await getSignClient()
  const pairings = signClient.core.pairing.getPairings()?.filter((p) => p.active) || []
  console.log('existing pairings', pairings)
  commit('SET_PAIRINGS', { pairings })
}

export const pairSignClient = async ({ dispatch }, { uri }) => {
  const signClient = await getSignClient()
  await signClient.core.pairing.pair({ uri })
  dispatch('getPairings')
}

export const getSessionProposals = async ({ commit }) => {
  const signClient = await getSignClient()
  const proposals = signClient.proposal.getAll()
  console.log('propsals', proposals)
  commit('SET_SESSION_PROPOSALS', { proposals })
}

export const getSessions = async ({ commit }) => {
  const signClient = await getSignClient()
  const sessions = signClient.session.getAll()
  console.log('sessions', sessions)
  commit('SET_SESSIONS', { sessions })
}

export const approveSession = async ({ dispatch }, { proposal, accounts }) => {
  console.log('approveSession', { proposal, accounts })
  const { id, requiredNamespaces } = proposal
  const { eip155 } = requiredNamespaces
  const { chains, methods, events } = eip155
  // Approve session proposal, use id from session proposal event and respond with namespace(s) that satisfy dapps request and contain approved accounts
  const req = {
    id,
    namespaces: {
      eip155: {
        accounts: accounts.map((a) => `${chains[0]}:${a}`),
        methods,
        events
      }
    }
  }
  console.log('req', req)
  const signClient = await getSignClient()
  const { topic, acknowledged } = await signClient.approve(req)
  console.log('topic', topic)
  const session = await acknowledged()
  console.log('approvedSession', session)
  await dispatch('getPairings')
  await dispatch('getSessions')
  await dispatch('getSessionProposals')
  return session && session.acknowledged
}

export const rejectSession = async (_, { session }) => {
  const signClient = await getSignClient()
  const { id } = session
  await signClient.reject({
    id,
    reason: {
      code: 1,
      message: 'rejected'
    }
  })
}

export const removeSessionProposal = async (_, { topic }) => {
  const signClient = await getSignClient()
  return signClient.proposal.delete(topic)
}

export const removeSession = async ({ dispatch }, { topic }) => {
  console.log('remove sessions called')
  const signClient = await getSignClient()
  const result = signClient.session.delete(topic)
  dispatch('getPairings')
  dispatch('getSessions')
  return result
}

export const removePairing = async ({ dispatch }, { topic }) => {
  console.log('removePairing called')
  const signClient = await getSignClient()
  const result = signClient.core.pairing.disconnect({ topic })
  dispatch('getPairings')
  return result
}

export const openWalletConnectTab = async (_, query = null) => {
  let url = browser.runtime.getURL('/index.html#/wallet-connect')
  if (query) {
    url = `${url}?${qs.stringify(query)}`
  }
  browser.tabs.create({
    url
  })
}

export const removeConnection = async ({ dispatch }, { connection }) => {
  const { sessions, pairings } = connection

  const sessionsRemovalTasks = sessions.map(({ topic }) => dispatch('removeSession', { topic }))
  const pairingsRemovalRes = pairings.map(({ topic }) => dispatch('removePairing', { topic }))

  await Promise.all([...sessionsRemovalTasks, ...pairingsRemovalRes])
}
