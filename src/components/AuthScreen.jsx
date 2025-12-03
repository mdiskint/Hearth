import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthScreen() {
    const { signIn, signUp } = useAuth();
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (isSignUp) {
                await signUp(email, password);
                setMessage('Check your email to confirm your account.');
            } else {
                await signIn(email, password);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.header}>
                    <h1 style={styles.title}>Hearth</h1>
                    <p style={styles.subtitle}>Dimensional Memory System</p>
                </div>

                <form onSubmit={handleSubmit} style={styles.form}>
                    {error && <div style={styles.error}>{error}</div>}
                    {message && <div style={styles.message}>{message}</div>}

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={styles.input}
                            placeholder="you@example.com"
                            required
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={styles.input}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button type="submit" style={styles.button} disabled={loading}>
                        {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                    </button>
                </form>

                <div style={styles.footer}>
                    <p style={styles.footerText}>
                        {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                    </p>
                    <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        style={styles.linkButton}
                    >
                        {isSignUp ? 'Sign In' : 'Sign Up'}
                    </button>
                </div>
            </div>
        </div>
    );
}

const styles = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f0f0f',
        color: '#e5e5e5',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    card: {
        width: '100%',
        maxWidth: '400px',
        padding: '40px',
        background: '#171717',
        borderRadius: '12px',
        border: '1px solid #262626',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
    },
    header: {
        textAlign: 'center',
        marginBottom: '32px',
    },
    title: {
        fontSize: '32px',
        fontWeight: '700',
        color: '#f97316',
        marginBottom: '8px',
    },
    subtitle: {
        color: '#737373',
        fontSize: '14px',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
    },
    inputGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    label: {
        fontSize: '12px',
        fontWeight: '500',
        color: '#a3a3a3',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    },
    input: {
        padding: '12px',
        background: '#0f0f0f',
        border: '1px solid #404040',
        borderRadius: '6px',
        color: '#e5e5e5',
        fontSize: '16px',
        outline: 'none',
        transition: 'border-color 0.2s',
    },
    button: {
        padding: '14px',
        background: '#f97316',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        marginTop: '12px',
        transition: 'background 0.2s',
    },
    error: {
        padding: '12px',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        color: '#fca5a5',
        borderRadius: '6px',
        fontSize: '14px',
    },
    message: {
        padding: '12px',
        background: 'rgba(34, 197, 94, 0.1)',
        border: '1px solid rgba(34, 197, 94, 0.2)',
        color: '#86efac',
        borderRadius: '6px',
        fontSize: '14px',
    },
    footer: {
        marginTop: '24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    footerText: {
        color: '#737373',
        fontSize: '14px',
    },
    linkButton: {
        background: 'none',
        border: 'none',
        color: '#f97316',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500',
    },
};
