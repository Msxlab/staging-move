import React, { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  resolveMobileServiceLogoAltName,
  resolveMobileServiceLogoUrl,
  type MobileServiceLogoSource,
} from "@/lib/service-logo";

type ServiceLogoMarkProps = {
  service: MobileServiceLogoSource;
  fallbackIcon: string;
  size?: number;
  logoSize?: number;
  borderRadius?: number;
  backgroundColor: string;
  borderColor: string;
  fallbackFontSize?: number;
};

export function ServiceLogoMark({
  service,
  fallbackIcon,
  size = 40,
  logoSize = 32,
  borderRadius = 12,
  backgroundColor,
  borderColor,
  fallbackFontSize = 16,
}: ServiceLogoMarkProps) {
  const { t } = useTranslation();
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const logoUrl = resolveMobileServiceLogoUrl(service);
  const showLogo = Boolean(logoUrl && logoUrl !== failedLogoUrl);
  const providerName = resolveMobileServiceLogoAltName(service);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor,
          borderColor,
        },
      ]}
    >
      {showLogo ? (
        <Image
          source={{ uri: logoUrl as string }}
          style={{ width: logoSize, height: logoSize, borderRadius: Math.max(0, borderRadius - 4) }}
          resizeMode="contain"
          accessibilityLabel={t("services.providerLogoA11y", { provider: providerName })}
          onError={() => setFailedLogoUrl(logoUrl)}
        />
      ) : (
        <Text style={[styles.fallbackIcon, { fontSize: fallbackFontSize }]}>{fallbackIcon}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  fallbackIcon: {
    lineHeight: 22,
  },
});
