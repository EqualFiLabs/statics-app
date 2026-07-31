"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export function BasketCreatePage() {
  const t = useTranslations("baskets");
  return (
    <>
      <section className="remaining-hero">
        <div>
          <p className="dapp-section-label">{t("launchPolicy")}</p>
          <h2>{t("stewardControlled")}</h2>
          <p>{t("launchDescription")}</p>
        </div>
        <span className="remaining-status is-warmup">{t("governedLaunch")}</span>
      </section>
      <section className="creation-workspace">
        <div className="creation-review">
          <section>
            <p className="dapp-section-label">{t("meaning")}</p>
            <h3>{t("noPublicTransaction")}</h3>
            <ul>
              <li>{t("existingRemainOpen")}</li>
              <li>{t("reviewedParameters")}</li>
              <li>{t("canEnableLater")}</li>
            </ul>
          </section>
          <section>
            <p className="dapp-section-label">{t("availableNow")}</p>
            <h3>{t("useCatalog")}</h3>
            <p>{t("inspectDescription")}</p>
            <Link className="ui-button ui-button--primary" href="/app/baskets">
              {t("browse")}
            </Link>
          </section>
        </div>
      </section>
    </>
  );
}
