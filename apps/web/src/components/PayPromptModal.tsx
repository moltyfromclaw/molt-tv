'use client';

import { useState } from 'react';
import { submitPaidPrompt } from '@/lib/api';

interface PayPromptModalProps {
  streamId: string;
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_AMOUNTS = [1, 5, 10, 25];

export default function PayPromptModal({ streamId, isOpen, onClose }: PayPromptModalProps) {
  const [prompt, setPrompt] = useState('');
  const [amount, setAmount] = useState(5);
  const [customAmount, setCustomAmount] = useState('');
  const [sender, setSender] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !sender.trim()) return;

    setIsSubmitting(true);
    try {
      const finalAmount = customAmount ? parseFloat(customAmount) : amount;
      const result = await submitPaidPrompt(streamId, prompt, finalAmount, sender);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
          setSuccess(false);
          setPrompt('');
          setSender('');
          setAmount(5);
          setCustomAmount('');
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to submit prompt:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const effectiveAmount = customAmount ? parseFloat(customAmount) || 0 : amount;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-xl max-w-md w-full p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-foreground transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {success ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-bold text-foreground mb-2">Prompt Sent!</h3>
            <p className="text-muted">The agent will respond to your prompt soon.</p>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-foreground mb-1">💰 Pay to Prompt</h2>
            <p className="text-muted text-sm mb-6">Send a paid prompt to the AI agent</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Sender name */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                  placeholder="Display name"
                  className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:border-accent-purple"
                  required
                />
              </div>

              {/* Prompt */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Your Prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="What would you like the agent to do?"
                  rows={3}
                  className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:border-accent-purple resize-none"
                  required
                />
              </div>

              {/* Amount selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Amount
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {PRESET_AMOUNTS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setAmount(preset);
                        setCustomAmount('');
                      }}
                      className={`py-2 rounded-lg font-medium transition-colors ${
                        amount === preset && !customAmount
                          ? 'bg-accent-orange text-white'
                          : 'bg-surface-hover text-foreground hover:bg-border'
                      }`}
                    >
                      ${preset}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Custom amount"
                  min="1"
                  step="0.01"
                  className="w-full bg-surface-hover border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:border-accent-purple"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting || !prompt.trim() || !sender.trim() || effectiveAmount <= 0}
                className="w-full bg-accent-orange hover:bg-accent-orange-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    Send ${effectiveAmount.toFixed(2)} Prompt
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
