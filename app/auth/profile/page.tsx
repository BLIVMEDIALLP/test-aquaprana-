'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh'
]

const DISTRICTS: Record<string, string[]> = {
  'Andhra Pradesh': ['Krishna','East Godavari','West Godavari','Guntur','Nellore','Prakasam','SPSR Nellore','Vishakhapatnam','Vizianagaram','Srikakulam','Kurnool','Kadapa','Chittoor','Anantapur'],
  'Telangana': ['Hyderabad','Rangareddy','Medchal','Warangal','Nizamabad','Karimnagar','Khammam','Nalgonda','Adilabad','Mahbubnagar'],
  'West Bengal': ['North 24 Parganas','South 24 Parganas','Purba Medinipur','Paschim Medinipur','Hooghly','Howrah','Kolkata','Nadia','Murshidabad','Bardhaman'],
  'Odisha': ['Kendrapara','Jagatsinghpur','Puri','Cuttack','Khordha','Balasore','Bhadrak','Ganjam','Mayurbhanj'],
  'Tamil Nadu': ['Chennai','Nagapattinam','Thanjavur','Tiruvarur','Ramanathapuram','Thoothukudi','Villupuram','Cuddalore','Krishnagiri'],
  'Kerala': ['Alappuzha','Ernakulam','Thiruvananthapuram','Kollam','Thrissur','Kozhikode','Kannur','Malappuram'],
  'Gujarat': ['Bharuch','Navsari','Surat','Valsad','Junagadh','Amreli','Bhavnagar','Kutch'],
  'Karnataka': ['Dakshina Kannada','Uttara Kannada','Udupi','Mangalore','Hassan','Tumkur'],
  'Maharashtra': ['Ratnagiri','Sindhudurg','Raigad','Thane','Mumbai','Nashik','Pune'],
  'Goa': ['North Goa','South Goa'],
}

export default function ProfilePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [state, setState] = useState('')
  const [district, setDistrict] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const districts = DISTRICTS[state] || []

  const handleSubmit = async () => {
    if (!name.trim() || name.trim().length < 2) { setError('Enter your full name'); return }
    if (!state) { setError('Select your state'); return }
    if (!district) { setError('Select your district'); return }

    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Demo mode
    if (sessionStorage.getItem('ap_demo')) {
      sessionStorage.setItem('ap_profile', JSON.stringify({ name, state, district }))
      router.replace('/ponds/new')
      return
    }

    if (!user) { router.replace('/auth/phone'); return }

    const { data: authUser } = await supabase.auth.getUser()
    const phoneNum = authUser?.user?.phone || ''

    const { error: err } = await supabase.from('users').upsert({
      id: user.id,
      phone: phoneNum,
      name: name.trim(),
      state,
      district,
      language: 'English',
    })
    if (err) {
      setError(err.message)
    } else {
      router.replace('/ponds/new')
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="bg-ap-blue px-6 pt-14 pb-8">
        <h1 className="text-2xl font-bold text-white">Complete your profile</h1>
        <p className="text-white/70 text-sm mt-1">Just a few details to get started</p>
      </div>

      <div className="flex-1 px-6 pt-8 space-y-5">
        <div>
          <label className="ap-label">Full name</label>
          <input
            type="text"
            className="ap-input"
            placeholder="Ravi Kumar"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="ap-label">State</label>
          <select
            className="ap-input"
            value={state}
            onChange={e => { setState(e.target.value); setDistrict('') }}
          >
            <option value="">Select state</option>
            {STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="ap-label">District</label>
          <select
            className="ap-input"
            value={district}
            onChange={e => setDistrict(e.target.value)}
            disabled={!state}
          >
            <option value="">Select district</option>
            {districts.map(d => <option key={d} value={d}>{d}</option>)}
            {state && districts.length === 0 && <option value="Other">Other</option>}
          </select>
        </div>

        {error && (
          <p className="text-ap-red text-sm bg-ap-red-light px-3 py-2 rounded-lg">{error}</p>
        )}

        <button
          className="ap-btn-primary"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto block" />
          ) : 'Get Started →'}
        </button>
      </div>
    </div>
  )
}
