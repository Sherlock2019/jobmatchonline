export function createSeed() {
  const now = Date.now();
  return {
    users: [
      { id: 'candidate-demo', role: 'candidate', name: 'Alex Morgan', title: 'Senior Product Designer', location: 'Ho Chi Minh City · Open to remote', photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop', skills: ['Product strategy', 'Figma', 'Design systems', 'Research'], languages: ['English', 'Vietnamese'], experienceLevel: 'senior', completeness: 92 },
      { id: 'employer-demo', role: 'employer', name: 'Maya Chen', title: 'Talent Partner at Northstar', company: 'Northstar', photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop', skills: ['Product strategy', 'Design systems'], languages: ['English'], experienceLevel: 'senior', completeness: 100 },
      { id: 'c-1', role: 'candidate', name: 'Jordan Lee', title: 'Staff Product Designer', location: 'Singapore', distanceKm: 5, photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop', skills: ['Design systems', 'Figma', 'Leadership', 'Research'], languages: ['English', 'Mandarin'], experienceLevel: 'lead', availability: 'Now' },
      { id: 'c-2', role: 'candidate', name: 'Priya Raman', title: 'Senior UX Researcher', location: 'Bengaluru · Remote', distanceKm: 26, photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop', skills: ['Research', 'Product strategy', 'Analytics'], languages: ['English', 'Hindi'], experienceLevel: 'senior', availability: '2 weeks' },
      { id: 'c-3', role: 'candidate', name: 'Minh Tran', title: 'Product Designer', location: 'Ho Chi Minh City', distanceKm: 12, photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop', skills: ['Figma', 'Prototyping', 'Design systems'], languages: ['English', 'Vietnamese'], experienceLevel: 'mid', availability: 'Now' },
      { id: 'c-4', role: 'candidate', name: 'Sofia Duarte', title: 'Senior Service Designer', location: 'Lisbon · Remote', distanceKm: 65, photo: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&h=400&fit=crop', skills: ['Service design', 'Research', 'Facilitation'], languages: ['English', 'Portuguese'], experienceLevel: 'senior', availability: '1 month' }
    ],
    jobs: [
      { id: 'j-1', employerId: 'employer-demo', title: 'Senior Product Designer', company: 'Northstar', logo: 'N', accent: '#3d5afe', location: 'Singapore · Hybrid', distanceKm: 7, workMode: 'Hybrid', salary: '$110k–$145k', type: 'Full-time', experienceLevel: 'senior', requiredSkills: ['Product strategy', 'Figma', 'Design systems', 'Research'], requiredLanguages: ['English'], description: 'Shape the intelligent work layer used by high-growth teams across APAC. You will own discovery through launch and raise the craft bar across our product.', mission: 'Make complex work feel beautifully simple.', culture: ['High trust', 'Customer obsessed', 'Low ego'], responseTime: '< 2 days', applicants: 84, status: 'Active' },
      { id: 'j-2', employerId: 'e-2', title: 'Lead Product Designer', company: 'Canvas Labs', logo: 'C', accent: '#ff5a5f', location: 'Remote · Asia', distanceKm: 18, workMode: 'Remote', salary: '$125k–$160k', type: 'Full-time', experienceLevel: 'lead', requiredSkills: ['Figma', 'Leadership', 'Design systems'], requiredLanguages: ['English'], description: 'Lead a small, senior design team building the collaboration canvas for modern creative organizations.', mission: 'Give every team a shared space to think.', culture: ['Remote first', 'Maker culture', 'Candid'], responseTime: '3 days', applicants: 126, status: 'Active' },
      { id: 'j-3', employerId: 'e-3', title: 'Product Design Lead, AI', company: 'Relay', logo: 'R', accent: '#00a884', location: 'London · Flexible', distanceKm: 42, workMode: 'Flexible', salary: '£95k–£125k', type: 'Full-time', experienceLevel: 'lead', requiredSkills: ['Product strategy', 'Research', 'Prototyping'], requiredLanguages: ['English'], description: 'Define human-centered AI experiences for a product helping millions navigate their working lives.', mission: 'Make opportunity visible to everyone.', culture: ['Evidence led', 'Inclusive', 'Ambitious'], responseTime: '< 1 week', applicants: 59, status: 'Active' },
      { id: 'j-4', employerId: 'e-4', title: 'Senior UX Designer', company: 'Orbit Health', logo: 'O', accent: '#8b5cf6', location: 'Sydney · Hybrid', distanceKm: 75, workMode: 'Hybrid', salary: 'A$145k–A$175k', type: 'Full-time', experienceLevel: 'senior', requiredSkills: ['Research', 'Figma', 'Service design'], requiredLanguages: ['English'], description: 'Design calm, accessible patient and clinician workflows across a rapidly growing digital health platform.', mission: 'Healthcare that meets people where they are.', culture: ['Purpose driven', 'Kind', 'Rigorous'], responseTime: '4 days', applicants: 41, status: 'Active' }
    ],
    swipes: [
      { id: 's-seed-1', actorId: 'employer-demo', targetType: 'candidate', targetId: 'candidate-demo', direction: 'like', createdAt: now - 3600000 }
    ],
    matches: [
      { id: 'm-candidate', candidateId: 'candidate-demo', employerId: 'e-3', jobId: 'j-3', stage: 'Matched', createdAt: now - 86400000 * 3 },
      { id: 'm-existing', candidateId: 'c-1', employerId: 'employer-demo', jobId: 'j-1', stage: 'Interview', createdAt: now - 86400000 * 2 },
      { id: 'm-priya', candidateId: 'c-2', employerId: 'employer-demo', jobId: 'j-1', stage: 'Matched', createdAt: now - 86400000 }
    ],
    messages: [
      { id: 'msg-candidate-1', matchId: 'm-candidate', senderId: 'e-3', text: 'Hi Alex — your product strategy work looks highly relevant to what we’re building at Relay.', createdAt: now - 10800000 },
      { id: 'msg-1', matchId: 'm-existing', senderId: 'employer-demo', text: 'Hi Jordan — your systems work really stood out. Would you be open to a 25-minute intro this week?', createdAt: now - 7200000 },
      { id: 'msg-2', matchId: 'm-existing', senderId: 'c-1', text: 'Absolutely. Thursday afternoon works well for me.', createdAt: now - 5400000 }
    ]
  };
}
