'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { ArrowLeft } from 'lucide-react'

export default function OTPPage() {
  const router = useRouter()
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [phone, setPhone] = useState('')
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const p = sessionStorage.getItem('ap_phone') || '+91 XXXXXXXXXX'
    setPhone(p)
  }, [])

  const handleDigit = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return
    const next = [...digits]
    next[idx] = val
    setDigits(next)
    if (val && idx < 5) refs.current[idx + 1]?.focus()
    if (next.every(d => d !== '')) verifyOTP(next.join(''))
  }

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      refs.current[idx - 1]?.focus()
    }
  }

  const verifyOTP = async (token: string) => {
    setLoading(true)
    setError('')
    const supabase = createClient()
    const phoneNum = sessionStorage.getItem('ap_phone') || ''
    const { data, error: err } = await supabase.auth.verifyOtp({
      phone: phoneNum,
      token,
      type: 'sms',
    })
    if (err) {
      setError(err.message)
      setDigits(['', '', '', '', '', ''])
      refs.current[0]?.focus()
    } else if (data.user) {
      // Check if profile exists
      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('id', data.user.id)
        .single()
      router.replace(profile ? '/home' : '/auth/profile')
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="bg-ap-blue px-6 pt-14 pb-8">
        <button onClick={() => router.back()} className="text-white/80 mb-4 flex items-center gap-1">
          <ArrowLeft size={18} /> Back
        </button>
        <h1 className="text-2xl font-bold text-white">Verify OTP</h1>
        <p className="text-white/70 text-sm mt-1">Sent to {phone}</p>
      </div>

      <div className="flex-1 px-6 pt-10">
        <h2 className="text-lg font-semibold text-ap-text mb-2">Enter 6-digit OTP</h2>
        <p className="text-ap-muted text-sm mb-8">OTP expires in 5 minutes</p>

        {/* OTP boxes */}
        <div className="flex gap-3 justify-center mb-8">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { refs.current[i] = el }}
              type="tel"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className="w-12 h-14 text-center text-2xl font-bold border-2 rounded-xl
                         bg-ap-gray text-ap-text
                         focus:border-ap-blue focus:outline-none
                         border-ap-border"
            />
          ))}
        </div>

        {error && (
          <p className="text-ap-red text-sm mb-4 bg-ap-red-light px-3 py-2 rounded-lg text-center">{error}</p>
        )}

        {loading && (
          <div className="flex justify-center">
            <span className="w-8 h-8 border-2 border-ap-blue/20 border-t-ap-blue rounded-full animate-spin" />
          </div>
        )}

        <p className="text-center text-ap-muted text-sm mt-6">
          Didn&apos;t receive it?{' '}
          <button
            className="text-ap-blue font-medium"
            onClick={() => router.back()}
          >
            Resend OTP
          </button>
        </p>
      </div>
    </div>
  )
}
