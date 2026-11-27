import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { APP_FONT_FAMILY } from '../constants/colors';
import { useTheme } from '../constants/theme';

interface AppHeaderProps {
    title: string;
    subtitle?: string;
    badge?: string;
    rightAction?: React.ReactNode;
    onBack?: () => void;
    compact?: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
    title,
    subtitle,
    badge,
    rightAction,
    onBack,
    compact = false,
}) => {
    const { theme } = useTheme();

    return (
        <View
            style={[
                styles.wrapper,
                {
                    backgroundColor: theme.headerBg,
                    borderBottomColor: theme.primary,
                },
                compact && styles.wrapperCompact,
            ]}
        >
            <View style={styles.row}>
                <View style={styles.left}>
                    {onBack && (
                        <TouchableOpacity
                            onPress={onBack}
                            accessibilityLabel="Go back"
                            accessibilityRole="button"
                            style={styles.iconButton}
                            activeOpacity={0.7}
                        >
                            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.headerText} />
                        </TouchableOpacity>
                    )}
                    <View style={styles.titleBlock}>
                        <Text style={[styles.title, { color: theme.headerText }]} numberOfLines={1}>
                            {title}
                        </Text>
                        {subtitle ? (
                            <Text style={[styles.subtitle, { color: theme.headerMuted }]} numberOfLines={1}>
                                {subtitle}
                            </Text>
                        ) : null}
                    </View>
                </View>

                {rightAction ? (
                    rightAction
                ) : badge ? (
                    <View style={[styles.badge, { backgroundColor: theme.headerSubtle }]}>
                        <Text style={[styles.badgeText, { color: theme.headerMuted }]}>{badge}</Text>
                    </View>
                ) : null}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 14,
        borderBottomWidth: 4,
    },
    wrapperCompact: {
        paddingTop: 8,
        paddingBottom: 10,
        borderBottomWidth: 0,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    titleBlock: {
        flex: 1,
    },
    title: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
    subtitle: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
    },
    badgeText: {
        fontFamily: APP_FONT_FAMILY,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    iconButton: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
