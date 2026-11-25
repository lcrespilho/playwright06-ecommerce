import { job } from './job'

// free-tier GCP supports a maximum of 2 instances
// GCP e2-medium with 2 vCPUs and 4GB-RAM supports ~8 instances (maximum)

/** SETTINGS **/
const CONCURRENCY: number = 2
export const CHURNPROBABILITY: number = 0.2 // User churn chance
export const NAVIGATIONSKIPTHRESHOLD: number = 0.1 // Chance to drop navigation between steps
export const GRANTCONSENTPROBABILITY: number = 0.5 // Probability to accept cookie consent
export const HEADLESS: boolean = process.env.HEADLESS !== 'false'
export const DEVTOOLS: boolean = process.env.DEVTOOLS === 'true'
export const LOG: boolean = process.env.LOG === 'true'
export const BOTVERSION: string = '6' // feeds GA4 event parameter "bot_version"
const USERBASE: number = 1000 // number of users
const FIREBASEDBNAMESPACE: string = 'ecommerce06'

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
    await job(session.sessionName)
    console.log('job finished')
    session.status = 'free' // Unlock the session/user
    activeJobs--
  }
}, 5000)
