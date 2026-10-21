// THE SECTION RULE ON A PDF, IN ONE PLACE.
//
// 21 Oct 2026. The purchase handover copies the handover's look on purpose, and
// the first version copied this component with it. lib/no-duplicate-logic.test
// caught it within the minute: "The same function body appears in more than one
// file. A fix applied to one copy is not a fix."
//
// It is right, and here it matters more than usual. The whole point of the two
// documents looking alike is that somebody holding both sees two pages from the
// same file. Two copies of the heading would drift, and the drift would be
// invisible until the day they are read side by side.
import React from 'react'
import { Text, View, StyleSheet } from '@react-pdf/renderer'

const INK = '#141C24', MUTE = '#7C8894'

const styles = StyleSheet.create({
  secRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 9 },
  secTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1.3, color: INK },
  secPill: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: .7, color: MUTE,
             backgroundColor: '#EEF2F5', borderRadius: 9, paddingVertical: 3, paddingHorizontal: 7, marginLeft: 8 },
  secLine: { flex: 1, height: 2, backgroundColor: '#EEF2F5', marginLeft: 8 },
})

export function Section({ title, pill }: { title: string; pill?: string }) {
  return (
    <View style={styles.secRow}>
      <Text style={styles.secTitle}>{title.toUpperCase()}</Text>
      {pill ? <Text style={styles.secPill}>{pill.toUpperCase()}</Text> : null}
      <View style={styles.secLine} />
    </View>
  )
}
