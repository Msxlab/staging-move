import React, { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { useAppTheme } from "@/lib/theme";
import {
  resolveMobileServiceLogoAltName,
  resolveMobileServiceLogoUrls,
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
  const theme = useAppTheme();
  const [failedLogoUrls, setFailedLogoUrls] = useState<Set<string>>(() => new Set());
  const logoUrls = resolveMobileServiceLogoUrls(service);
  const logoUrl = logoUrls.find((url) => !failedLogoUrls.has(url)) || null;
  const showLogo = Boolean(logoUrl);
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
          onError={() => {
            if (logoUrl) setFailedLogoUrls((current) => new Set(current).add(logoUrl));
          }}
        />
      ) : (
        <CategoryIcon emoji={fallbackIcon} size={Math.max(14, fallbackFontSize)} color={theme.colors.textSecondary} />
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
});
