'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { Phone, ChevronRight } from 'lucide-react'

export default function PhonePage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSendOTP = async () => {
    const clean = phone.replace(/\s/g, '')
    if (clean.length < 10) {
      setError('Enter a valid 10-digit mobile number')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const fullPhone = `+91${clean}`
    const { error: err } = await supabase.auth.signInWithOtp({ phone: fullPhone })
    if (err) {
      setError(err.message)
    } else {
      sessionStorage.setItem('ap_phone', fullPhone)
      router.push('/auth/otp')
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <div className="bg-ap-blue px-6 pt-16 pb-10">
        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
            <path d="M24 4C24 4 10 18 10 28C10 35.7 16.3 42 24 42C31.7 42 38 35.7 38 28C38 18 24 4 24 4Z" fill="white"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white">AquaPrana</h1>
        <p className="text-white/70 text-sm mt-1">Life force for your ponds</p>
      </div>

      <div className="flex-1 px-6 pt-8">
        <h2 className="text-xl font-bold text-ap-text mb-1">Enter your mobile number</h2>
        <p className="text-ap-muted text-sm mb-8">We'll send you a one-time password to verify</p>

        {/* Phone input */}
        <div className="mb-6">
          <label className="ap-label">Phone number</label>
          <div className="flex gap-2">
            <div className="flex items-center bg-ap-gray border border-ap-border rounded-xl px-3 py-3.5 text-base font-medium text-ap-text min-w-[64px]">
              +91
            </div>
            <input
              type="tel"
              inputMode="numeric"
              className="ap-input flex-1"
              placeholder="98765 43210"
              value={phone}
              maxLength={10}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              onKeyDown={e => e.key === 'Enter' && handleSendOTP()}
            />
          </div>
        </div>

        {error && (
          <p className="text-ap-red text-sm mb-4 bg-ap-red-light px-3 py-2 rounded-lg">{error}</p>
        )}

        <button
          className="ap-btn-primary flex items-center justify-center gap-2"
          onClick={handleSendOTP}
          disabled={loading}
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>Send OTP <ChevronRight size={18} /></>
          )}
        </button>

        <p className="text-ap-muted text-xs text-center mt-6">
          By continuing you agree to our Terms of Service
        </p>
      </div>

      {/* Demo shortcut */}
      <div className="px-6 pb-8">
        <button
          className="w-full text-ap-muted text-sm py-3 border border-dashed border-ap-border rounded-xl"
          onClick={() => {
            sessionStorage.setItem('ap_demo', '1')
            router.push('/home')
          }}
        >
          Continue with Demo (no SMS needed)
        </button>
      </div>
    </div>
  )
}
