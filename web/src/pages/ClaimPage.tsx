import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'

interface Agent {
  id: string
  name: string
  description?: string
  status: string
  verified_at: string
  capabilities?: string[]
  model_family?: string
  framework?: string
}

interface Verification {
  code: string
  tweet_text: string
  tweet_intent_url: string
  expires_at: string
}

interface ClaimInfo {
  agent: Agent
  claim_expires_at: string
  already_claimed: boolean
  owner?: {
    provider: string
    handle: string
  }
  verification?: Verification
}

export default function ClaimPage() {
  const { token } = useParams<{ token: string }>()
  const [claimInfo, setClaimInfo] = useState<ClaimInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tweetUrl, setTweetUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [claimedHandle, setClaimedHandle] = useState<string | null>(null)

  const API_BASE = import.meta.env.VITE_API_URL || ''

  useEffect(() => {
    async function fetchClaimInfo() {
      try {
        const res = await fetch(`${API_BASE}/api/v1/claim/${token}`)
        const data = await res.json()
        
        if (!res.ok) {
          setError(data.error || 'Invalid or expired claim link')
          return
        }
        
        setClaimInfo(data)
      } catch (err) {
        setError('Failed to load claim information')
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      fetchClaimInfo()
    }
  }, [token, API_BASE])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch(`${API_BASE}/api/v1/claim/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweet_url: tweetUrl }),
      })

      const data = await res.json()

      if (!res.ok) {
        setSubmitError(data.error || 'Failed to verify claim')
        return
      }

      setSuccess(true)
      setClaimedHandle(data.owner?.handle)
    } catch (err) {
      setSubmitError('Failed to submit claim. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading claim information...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-white mb-2">Claim Failed</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link 
            to="/" 
            className="text-blue-400 hover:text-blue-300"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    )
  }

  if (!claimInfo) {
    return null
  }

  const { agent, already_claimed, owner, verification, claim_expires_at } = claimInfo
  const expiresIn = new Date(claim_expires_at).getTime() - Date.now()
  const expiresInHours = Math.max(0, Math.floor(expiresIn / (1000 * 60 * 60)))
  const expiresInDays = Math.floor(expiresInHours / 24)

  // Success state
  if (success) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-white mb-2">Successfully Claimed!</h1>
          <p className="text-gray-400 mb-6">
            <span className="text-white font-medium">{agent.name}</span> is now linked to{' '}
            <span className="text-blue-400">@{claimedHandle}</span>
          </p>
          <Link 
            to={`/a/${encodeURIComponent(agent.name)}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors"
          >
            View Agent Profile →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Agent Card */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8 mb-8">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-4xl">
            🤖
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-white">{agent.name}</h1>
              {agent.status === 'verified' && (
                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-sm rounded-full flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Verified Agent
                </span>
              )}
            </div>
            {agent.description && (
              <p className="text-gray-400 mb-4">{agent.description}</p>
            )}
            <div className="flex flex-wrap gap-2 text-sm">
              {agent.model_family && (
                <span className="px-2 py-1 bg-gray-700 rounded text-gray-300">
                  {agent.model_family}
                </span>
              )}
              {agent.framework && (
                <span className="px-2 py-1 bg-gray-700 rounded text-gray-300">
                  {agent.framework}
                </span>
              )}
              <span className="px-2 py-1 bg-gray-700 rounded text-gray-300">
                Verified {new Date(agent.verified_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Claim Section */}
      {already_claimed && owner ? (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-white mb-2">Already Claimed</h2>
          <p className="text-gray-400 mb-4">
            This agent has been claimed by{' '}
            <a 
              href={`https://x.com/${owner.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300"
            >
              @{owner.handle}
            </a>
          </p>
          <Link 
            to={`/a/${encodeURIComponent(agent.name)}`}
            className="text-blue-400 hover:text-blue-300"
          >
            View agent profile →
          </Link>
        </div>
      ) : verification ? (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8">
          <h2 className="text-xl font-bold text-white mb-2 text-center">
            Claim This Agent
          </h2>
          <p className="text-gray-400 text-center mb-6">
            Prove you own <span className="text-white font-medium">{agent.name}</span> by 
            posting a verification tweet.
          </p>

          {/* Step 1: Post Tweet */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center font-bold">1</span>
              <h3 className="font-medium text-white">Post this to X</h3>
            </div>
            
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <p className="text-gray-300 whitespace-pre-wrap text-sm font-mono">
                {verification.tweet_text}
              </p>
            </div>

            <div className="flex gap-3">
              <a
                href={verification.tweet_intent_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-black hover:bg-gray-900 border border-gray-600 rounded-lg text-white font-medium transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                Post to X
              </a>
              <button
                onClick={() => navigator.clipboard.writeText(verification.tweet_text)}
                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
                title="Copy to clipboard"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Step 2: Paste Tweet URL */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center font-bold">2</span>
              <h3 className="font-medium text-white">Paste your tweet URL</h3>
            </div>

            <form onSubmit={handleSubmit}>
              <input
                type="url"
                value={tweetUrl}
                onChange={(e) => setTweetUrl(e.target.value)}
                placeholder="https://x.com/yourname/status/123456..."
                className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-4"
                required
              />

              {submitError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !tweetUrl}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
              >
                {submitting ? 'Verifying...' : 'Verify & Claim'}
              </button>
            </form>
          </div>

          {/* Verification Code Display */}
          <div className="mt-6 pt-6 border-t border-gray-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Verification code:</span>
              <code className="px-2 py-1 bg-gray-900 rounded text-blue-400 font-mono">
                {verification.code}
              </code>
            </div>
          </div>

          {/* Expiry Warning */}
          <p className="text-center text-sm text-gray-500 mt-4">
            This claim link expires in{' '}
            <span className="text-yellow-400">
              {expiresInDays > 0 ? `${expiresInDays} days` : `${expiresInHours} hours`}
            </span>
          </p>
        </div>
      ) : (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8 text-center">
          <p className="text-gray-400">Unable to load verification data. Please refresh the page.</p>
        </div>
      )}

      {/* Why Claim? */}
      {!already_claimed && (
        <div className="mt-8 bg-gray-800/30 rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Why claim your agent?</h3>
          <ul className="text-sm text-gray-400 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-green-400">✓</span>
              Show platforms and users who operates this agent
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400">✓</span>
              Build trust with a verified human owner
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400">✓</span>
              Prevent impersonation of your agent
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400">✓</span>
              Required by some platforms for full access
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
