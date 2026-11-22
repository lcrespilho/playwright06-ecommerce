import { job } from './job'

// free-tier GCP supports a maximum of 2 instances
// GCP e2-medium with 2 vCPUs and 4GB-RAM supports ~8 instances (maximum)

/** SETTINGS **/
const CONCURRENCY = 2
export const CHURNPROBABILITY = 0 // User churn chance
export const NAVIGATIONSKIPTHRESHOLD = 0.0 // Chance to drop navigation between steps
export const GRANTCONSENTPROBABILITY = 1 // Probability to accept cookie consent
export const HEADLESS = process.env.HEADLESS !== 'false'
export const DEVTOOLS = process.env.DEVTOOLS === 'true'
export const LOG = process.env.LOG === 'true'
const USERBASE = 20 // number of users
const FIREBASEDBNAMESPACE = 'ecommerce01'
const BOTVERSION = '4'

let activeJobs = 0

export type Session = {
  sessionName: string
  status: 'free' | 'locked'
}

// O controle de sessões serve para que duas navegações nunca ocorram com a mesma sessão/usuário.
const sessions: Session[] = new Array(USERBASE).fill(0).map((_, idx) => ({
  sessionName: `${FIREBASEDBNAMESPACE}/session_${idx.toString().padStart(5, '0')}`,
  status: 'free',
}))
function getFreeSession(): Session | undefined {
  const freeSessions = sessions.filter(session => session.status === 'free')
  if (freeSessions.length) {
    const freeSession = freeSessions[Math.floor(Math.random() * freeSessions.length)]
    return freeSession
  }
}

setInterval(async () => {
  const session = getFreeSession()
  if (session && activeJobs < CONCURRENCY) {
    activeJobs++
    session.status = 'locked' // Lock the session/user
    console.log(
      `🟢 new job: jobs: ${activeJobs}/${CONCURRENCY} - locked sessions: ${sessions.filter(session => session.status === 'locked').length}/${USERBASE}`,
    )
    await job(session.sessionName, BOTVERSION)
    console.log('job finished')
    session.status = 'free' // Unlock the session/user
    activeJobs--
  }
}, 5000)
