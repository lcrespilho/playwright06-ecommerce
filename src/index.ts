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
const FIREBASEDBNAMESPACE = 'ecommerce04'

let activeJobs = 0

type Session = {
  sessionName: string
  status: 'free' | 'locked'
  leaseUntil: number
}

const sessions: Session[] = new Array(USERBASE).fill(0).map((_, idx) => ({
  sessionName: `${FIREBASEDBNAMESPACE}/session_${idx.toString().padStart(5, '0')}`,
  status: 'free',
  leaseUntil: 0,
}))

function getFreeSession(sessions: Session[]) {
  // Clean up expired session leases before returning a free session
  sessions
    .filter(session => session.status === 'locked')
    .forEach(session => {
      if (Math.round(performance.now() / 1000) > session.leaseUntil) {
        LOG && console.log('liberando lease')
        session.leaseUntil = 0
        session.status = 'free'
      }
    })

  const freeSessions = sessions.filter(session => session.status === 'free')
  const freeSession = freeSessions[Math.floor(Math.random() * freeSessions.length)]
  if (freeSession) {
    // Lock the session for 6 minutes (GA session time = 5 min)
    freeSession.leaseUntil = Math.round(performance.now() / 1000) + 6 * 60 // now + 6 minutes
    freeSession.status = 'locked'
  }
  return freeSession
}

async function startNewJob() {
  const session = getFreeSession(sessions)
  if (session) {
    activeJobs++
    LOG && console.log('\nNew job')
    await job(session.sessionName)
    session.leaseUntil = Math.round(performance.now() / 1000) + 6 * 60 // now + 6 minutes
    activeJobs--
  }
}

setInterval(() => {
  console.log(
    `active jobs: ${activeJobs}/${CONCURRENCY} - locked sessions: ${sessions.filter(session => session.status === 'locked').length}/${USERBASE}`,
  )
  if (activeJobs < CONCURRENCY) {
    startNewJob()
  }
}, 5000)
