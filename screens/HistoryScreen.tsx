import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { COLORS } from '../constants/colors';
import { ScreenWrapper } from '../components/ScreenWrapper';

export default function HistoryScreen() {
    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={styles.contentContainer}>
                <View style={styles.center}>
                    <Text style={styles.text}>History (Past Matches)</Text>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    contentContainer: {
        flexGrow: 1,
        paddingBottom: 110,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
});
