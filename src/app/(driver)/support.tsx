import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { router } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { createSupportTicket } from '@/features/support/services/support-ticket.service';
import { firestore } from '@/services/firebase/firebase';
import { useSession } from '@pakyaw/shared/features/auth/hooks/useSession';

export default function DriverSupportScreen() {
  const { uid } = useSession();
  const [subject, setSubject] = useState(''); const [body, setBody] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null);
  const [tickets, setTickets] = useState<readonly { readonly id: string; readonly subject: string; readonly status: string }[]>([]);
  useEffect(() => { if (!uid) return; return onSnapshot(query(collection(firestore, 'supportTickets'), where('createdBy', '==', uid)), (snapshot) => setTickets(snapshot.docs.map((ticket) => ({ id: ticket.id, subject: String(ticket.data().subject ?? 'Support request'), status: String(ticket.data().status ?? 'open') })))); }, [uid]);
  const submit = async () => { setBusy(true); setMessage(null); try { const ticket = await createSupportTicket({ category: 'driver', subject, body }); setSubject(''); setBody(''); setMessage(`Support ticket ${ticket.ticketId} was created.`); } catch { setMessage('Your support request could not be sent. Please try again.'); } finally { setBusy(false); } };
  return <ScrollView contentContainerStyle={styles.container}><Pressable onPress={() => router.back()}><Text style={styles.back}>← Back</Text></Pressable><Text style={styles.title}>Driver support</Text><Text style={styles.label}>SUBJECT</Text><TextInput style={styles.input} value={subject} onChangeText={setSubject} placeholder="How can we help?" /><Text style={styles.label}>DETAILS</Text><TextInput style={[styles.input, styles.body]} value={body} onChangeText={setBody} multiline placeholder="Tell us what happened" /><Pressable disabled={busy || subject.trim().length === 0 || body.trim().length === 0} onPress={submit} style={styles.button}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Submit request</Text>}</Pressable>{message ? <Text style={styles.message}>{message}</Text> : null}<Text style={styles.label}>YOUR REQUESTS</Text>{tickets.map((ticket) => <Text key={ticket.id} style={styles.ticket}>{ticket.subject} — {ticket.status.replace(/_/g, ' ')}</Text>)}</ScrollView>;
}
const styles = StyleSheet.create({ container: { flexGrow: 1, padding: 24, gap: 12, backgroundColor: '#F7FAFE' }, back: { color: '#2F80ED', fontWeight: '700' }, title: { fontSize: 28, fontWeight: '700', color: '#0E1726', marginTop: 16 }, label: { fontSize: 12, color: '#6B7689', fontWeight: '700', marginTop: 8 }, input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E6EBF2', borderRadius: 10, padding: 14 }, body: { minHeight: 130, textAlignVertical: 'top' }, button: { backgroundColor: '#27AE60', borderRadius: 999, padding: 16, alignItems: 'center', marginTop: 12 }, buttonText: { color: '#fff', fontWeight: '700' }, message: { color: '#0E1726' }, ticket: { backgroundColor: '#fff', borderRadius: 8, padding: 12, color: '#0E1726' } });
