import { FormEvent, useState } from 'react';

export interface ContactFormValues {
  userId: string;
  email: string;
  message: string;
}

interface Props {
  onSubmit: (values: ContactFormValues) => Promise<void>;
  submitting?: boolean;
  initialValues?: Partial<ContactFormValues>;
}

const emptyValues: ContactFormValues = {
  userId: '',
  email: '',
  message: '',
};

const ContactForm = ({ onSubmit, submitting, initialValues }: Props) => {
  const [values, setValues] = useState<ContactFormValues>({
    ...emptyValues,
    ...initialValues,
  });
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleChange = (field: keyof ContactFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus(null);
    try {
      await onSubmit(values);
      setValues({ ...emptyValues });
      setStatus({ type: 'success', message: 'Message sent successfully.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send message.';
      setStatus({ type: 'error', message });
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {status && (
        <div
          className={`rounded px-4 py-3 text-sm ${
            status.type === 'success'
              ? 'bg-green-500/10 border border-green-500/30 text-green-200'
              : 'bg-red-500/10 border border-red-500/30 text-red-200'
          }`}
        >
          {status.message}
        </div>
      )}
      <label className="flex flex-col gap-2 text-sm font-semibold text-gray-300">
        Email
        <input
          type="email"
          value={values.email}
          onChange={(e) => handleChange('email', e.target.value)}
          className="rounded border border-white/10 bg-black/40 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-semibold text-gray-300">
        Message
        <textarea
          value={values.message}
          onChange={(e) => handleChange('message', e.target.value)}
          rows={5}
          className="rounded border border-white/10 bg-black/40 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          required
        />
      </label>
      <button
        type="submit"
        className="btn-primary"
        disabled={submitting}
      >
        {submitting ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  );
};

export default ContactForm;
