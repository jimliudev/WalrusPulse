import { Link } from 'react-router-dom'
import { Waves, Shield, Database, Share2, BarChart2, ArrowRight, FileText, Star, CheckSquare, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const features = [
  {
    icon: <FileText className="h-6 w-6 text-teal-600" />,
    title: 'Custom Form Builder',
    desc: 'Drag-and-drop fields: text, dropdowns, checkboxes, star ratings, file uploads, URLs and more.',
  },
  {
    icon: <Database className="h-6 w-6 text-teal-600" />,
    title: 'Walrus Storage',
    desc: 'Every form schema and submission is stored permanently on the Walrus decentralised storage network.',
  },
  {
    icon: <Shield className="h-6 w-6 text-teal-600" />,
    title: 'On-Chain Registry',
    desc: 'Forms are registered on the Sui blockchain, giving you a tamper-proof audit trail of all submissions.',
  },
  {
    icon: <Share2 className="h-6 w-6 text-teal-600" />,
    title: 'Shareable Links',
    desc: 'Publish your form and share a single link. Anyone with a Sui wallet can submit a response.',
  },
  {
    icon: <BarChart2 className="h-6 w-6 text-teal-600" />,
    title: 'Admin Dashboard',
    desc: 'Review, filter, and prioritise all your feedback from one place. Export to CSV with one click.',
  },
  {
    icon: <Upload className="h-6 w-6 text-teal-600" />,
    title: 'Media Uploads',
    desc: 'Respondents can attach screenshots and videos, uploaded directly to Walrus for permanent storage.',
  },
]

const fieldTypes = [
  { icon: <FileText className="h-4 w-4" />, label: 'Rich Text' },
  { icon: <CheckSquare className="h-4 w-4" />, label: 'Checkboxes' },
  { icon: <Star className="h-4 w-4" />, label: 'Star Rating' },
  { icon: <Upload className="h-4 w-4" />, label: 'File Upload' },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero */}
      <section className="relative overflow-hidden py-24 px-4 sm:px-6">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-teal-100/40 rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto text-center space-y-6">
          <Badge variant="default" className="gap-2 px-4 py-1.5 text-sm">
            <Waves className="h-4 w-4" />
            Built on Walrus + Sui
          </Badge>

          <h1 className="text-5xl sm:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Feedback that lives{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-cyan-500">
              on-chain
            </span>
          </h1>

          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            WalrusPulse lets teams and communities collect structured feedback directly on the
            blockchain. Build beautiful forms, store submissions on Walrus, and review everything
            from a powerful admin dashboard.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link to="/builder">
              <Button size="lg" className="gap-2 shadow-md">
                Create a Form
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/admin">
              <Button size="lg" variant="outline" className="gap-2">
                View Dashboard
                <BarChart2 className="h-5 w-5" />
              </Button>
            </Link>
          </div>

          {/* Field type pills */}
          <div className="flex flex-wrap justify-center gap-2 pt-4">
            {fieldTypes.map(({ icon, label }) => (
              <span
                key={label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-sm text-slate-600 shadow-sm"
              >
                {icon}
                {label}
              </span>
            ))}
            <span className="flex items-center px-3 py-1.5 rounded-full bg-white border border-slate-200 text-sm text-slate-400">
              + more
            </span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">Everything you need</h2>
            <p className="text-slate-500 mt-2">A complete feedback platform powered by Web3</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow hover:border-teal-200"
              >
                <div className="h-12 w-12 rounded-xl bg-teal-50 flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-1">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 sm:px-6 bg-slate-50">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h2 className="text-3xl font-bold text-slate-900">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-8 mt-10 text-left">
            {[
              {
                step: '1',
                title: 'Build',
                desc: 'Use the drag-and-drop builder to design your form with any field types you need.',
              },
              {
                step: '2',
                title: 'Publish',
                desc: 'Publish the form. The schema is uploaded to Walrus and registered on Sui.',
              },
              {
                step: '3',
                title: 'Collect',
                desc: 'Share the link. All responses are stored on Walrus and tracked on-chain.',
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col gap-3">
                <div className="h-10 w-10 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
                  {step}
                </div>
                <h3 className="font-semibold text-slate-900 text-lg">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <Waves className="h-12 w-12 text-teal-600 mx-auto" />
          <h2 className="text-3xl font-bold text-slate-900">Ready to collect feedback?</h2>
          <p className="text-slate-500">
            Connect your Sui wallet and create your first form in minutes.
          </p>
          <Link to="/builder">
            <Button size="lg" className="gap-2 shadow-md">
              Get Started
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 px-4 text-center text-sm text-slate-400">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Waves className="h-4 w-4 text-teal-600" />
          <span className="font-semibold text-slate-600">WalrusPulse</span>
        </div>
        Built on Walrus decentralised storage &amp; Sui blockchain
      </footer>
    </div>
  )
}
