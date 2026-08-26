import { describe, expect, test } from "bun:test"

import { resources } from "./resources"

type InventoryEntry = {
  source: string
  key: string
}

const requiredUiInventory: InventoryEntry[] = [
  { source: "src/components/Footer.tsx:11", key: "common.footerCopyright" },
  { source: "src/components/Footer.tsx:16", key: "common.accessibility.linkedin" },
  { source: "src/components/Footer.tsx:22", key: "common.accessibility.github" },
  { source: "src/components/Footer.tsx:28", key: "common.accessibility.email" },
  { source: "src/components/LoadingOverlay.tsx:6", key: "common.loading" },
  { source: "src/components/Navbar.tsx:18", key: "common.logoutConfirmation.title" },
  { source: "src/components/Navbar.tsx:18", key: "common.logoutConfirmation.description" },
  { source: "src/components/Navbar.tsx:18", key: "common.logoutConfirmation.confirm" },
  { source: "src/components/Navbar.tsx:30", key: "common.accessibility.openMenu" },
  { source: "src/components/Navbar.tsx:50", key: "common.accessibility.logout" },
  { source: "src/components/Navbar.tsx:56", key: "navigation.login" },
  { source: "src/components/Pagination.tsx:36", key: "common.pagination.rowsPerPage" },
  { source: "src/components/Pagination.tsx:57", key: "common.pagination.page" },
  { source: "src/components/Pagination.tsx:64", key: "common.previous" },
  { source: "src/components/Pagination.tsx:71", key: "common.next" },
  { source: "src/components/ProductSelectionModal.tsx:212", key: "errors.products.selectItems" },
  { source: "src/components/ProductSelectionModal.tsx:155", key: "errors.loadProducts" },
  { source: "src/components/ProductSelectionModal.tsx:242", key: "products.selection.description" },
  { source: "src/components/ProductSelectionModal.tsx:135", key: "products.selection.fallbackProduct" },
  { source: "src/components/ProductSelectionModal.tsx:248", key: "common.customer" },
  { source: "src/components/ProductSelectionModal.tsx:251", key: "products.selection.clientPlaceholder" },
  { source: "src/components/ProductSelectionModal.tsx:262", key: "products.selection.available" },
  { source: "src/components/ProductSelectionModal.tsx:265", key: "products.selection.searchPlaceholder" },
  { source: "src/components/ProductSelectionModal.tsx:272", key: "products.selection.categoryPlaceholder" },
  { source: "src/components/ProductSelectionModal.tsx:275", key: "products.selection.allCategories" },
  { source: "src/components/ProductSelectionModal.tsx:294", key: "products.selection.noProducts" },
  { source: "src/components/ProductSelectionModal.tsx:308", key: "products.selection.addProduct" },
  { source: "src/components/ProductSelectionModal.tsx:336", key: "common.previous" },
  { source: "src/components/ProductSelectionModal.tsx:346", key: "common.next" },
  { source: "src/components/ProductSelectionModal.tsx:321", key: "common.pageOf" },
  { source: "src/components/ProductSelectionModal.tsx:350", key: "products.selection.selected" },
  { source: "src/components/ProductSelectionModal.tsx:353", key: "products.selection.noItems" },
  { source: "src/components/ProductSelectionModal.tsx", key: "common.unitCount.zero" },
  { source: "src/components/ProductSelectionModal.tsx", key: "common.unitCount.one" },
  { source: "src/components/ProductSelectionModal.tsx", key: "common.unitCount.two" },
  { source: "src/components/ProductSelectionModal.tsx", key: "common.unitCount.few" },
  { source: "src/components/ProductSelectionModal.tsx", key: "common.unitCount.many" },
  { source: "src/components/ProductSelectionModal.tsx", key: "common.unitCount.other" },
  { source: "src/components/ProductSelectionModal.tsx:399", key: "products.selection.decreaseQuantity" },
  { source: "src/components/ProductSelectionModal.tsx:413", key: "products.selection.increaseQuantity" },
  { source: "src/components/ProductSelectionModal.tsx:425", key: "products.selection.removeItem" },
  { source: "src/components/ProductSelectionModal.tsx:401", key: "common.total" },
  { source: "src/components/ProductSelectionModal.tsx:415", key: "orders.confirm.changeStatus" },
  { source: "src/components/ProductSelectionModal.tsx:426", key: "errors.changeOrderStatus" },
  { source: "src/components/ProductSelectionModal.tsx:433", key: "products.selection.statusPlaceholder" },
  { source: "src/components/ProductSelectionModal.tsx:436", key: "status.open" },
  { source: "src/components/ProductSelectionModal.tsx:437", key: "status.inPreparation" },
  { source: "src/components/ProductSelectionModal.tsx:438", key: "status.delivering" },
  { source: "src/components/ProductSelectionModal.tsx:439", key: "status.closed" },
  { source: "src/components/ProductSelectionModal.tsx:453", key: "sales.confirm.cancel" },
  { source: "src/components/ProductSelectionModal.tsx:453", key: "sales.cancel" },
  { source: "src/components/ProductSelectionModal.tsx:460", key: "errors.cancelSale" },
  { source: "src/components/ProductSelectionModal.tsx:464", key: "sales.cancelling" },
  { source: "src/components/ProductSelectionModal.tsx:468", key: "sales.cancelButton" },
  { source: "src/components/ProductSelectionModal.tsx:478", key: "common.close" },
  { source: "src/components/ProductSelectionModal.tsx:478", key: "common.cancel" },
  { source: "src/components/ProductSelectionModal.tsx:482", key: "common.saving" },
  { source: "src/components/ProductSelectionModal.tsx:486", key: "common.confirm" },
  { source: "src/components/dashboard/FiltersBar.tsx:96", key: "common.filters" },
  { source: "src/components/dashboard/FiltersBar.tsx:104", key: "common.accessibility.collapseFilters" },
  { source: "src/components/dashboard/FiltersBar.tsx:104", key: "common.accessibility.expandFilters" },
  { source: "src/components/dashboard/FiltersBar.tsx:114", key: "charts.filters.startDate" },
  { source: "src/components/dashboard/FiltersBar.tsx:124", key: "charts.filters.startTime" },
  { source: "src/components/dashboard/FiltersBar.tsx:134", key: "charts.filters.endDate" },
  { source: "src/components/dashboard/FiltersBar.tsx:144", key: "charts.filters.endTime" },
  { source: "src/components/dashboard/FiltersBar.tsx:158", key: "common.status" },
  { source: "src/components/dashboard/FiltersBar.tsx:161", key: "common.status" },
  { source: "src/components/dashboard/FiltersBar.tsx:174", key: "common.customer" },
  { source: "src/components/dashboard/FiltersBar.tsx:177", key: "common.placeholders.customer" },
  { source: "src/components/dashboard/FiltersBar.tsx:187", key: "common.createdBy" },
  { source: "src/components/dashboard/FiltersBar.tsx:190", key: "common.placeholders.employee" },
  { source: "src/components/dashboard/FiltersBar.tsx:201", key: "common.minimumTotal" },
  { source: "src/components/dashboard/FiltersBar.tsx:205", key: "common.placeholders.amount" },
  { source: "src/components/dashboard/FiltersBar.tsx:212", key: "common.maximumTotal" },
  { source: "src/components/dashboard/FiltersBar.tsx:216", key: "common.placeholders.amount" },
  { source: "src/components/dashboard/FiltersBar.tsx:234", key: "common.search" },
  { source: "src/components/mode-toggle.tsx:32", key: "common.accessibility.toggleTheme" },
  { source: "src/components/ui/dialog.tsx:53", key: "common.accessibility.close" },
  { source: "src/contexts/ConfirmContext.tsx:47", key: "common.confirmQuestion" },
  { source: "src/contexts/ConfirmContext.tsx:51", key: "common.cancel" },
  { source: "src/contexts/ConfirmContext.tsx:57", key: "common.yes" },
  { source: "src/layouts/DashboardLayout.tsx:61", key: "common.logoutConfirmation.title" },
  { source: "src/layouts/DashboardLayout.tsx:62", key: "common.logoutConfirmation.description" },
  { source: "src/layouts/DashboardLayout.tsx:63", key: "common.logoutConfirmation.confirm" },
  { source: "src/layouts/DashboardLayout.tsx:69", key: "navigation.orders" },
  { source: "src/layouts/DashboardLayout.tsx:70", key: "navigation.sales" },
  { source: "src/layouts/DashboardLayout.tsx:71", key: "navigation.products" },
  { source: "src/layouts/DashboardLayout.tsx:72", key: "navigation.employees" },
  { source: "src/layouts/DashboardLayout.tsx:73", key: "navigation.reports" },
  { source: "src/layouts/DashboardLayout.tsx:74", key: "navigation.settings" },
  { source: "src/layouts/DashboardLayout.tsx:81", key: "navigation.dashboard" },
  { source: "src/layouts/DashboardLayout.tsx:144", key: "navigation.expandMenu" },
  { source: "src/layouts/DashboardLayout.tsx:144", key: "navigation.collapseMenu" },
  { source: "src/layouts/DashboardLayout.tsx:159", key: "navigation.logout" },
  { source: "src/layouts/DashboardLayout.tsx:219", key: "navigation.closeMenu" },
  { source: "src/pages/LandingPage.tsx:39", key: "common.landing.heroImageAlt" },
  { source: "src/pages/LandingPage.tsx:46", key: "common.landing.heroTitle" },
  { source: "src/pages/LandingPage.tsx:48", key: "common.landing.heroHighlight" },
  { source: "src/pages/LandingPage.tsx:51", key: "common.landing.heroDescription" },
  { source: "src/pages/LandingPage.tsx:57", key: "common.landing.startUsing" },
  { source: "src/pages/LandingPage.tsx:65", key: "common.landing.viewPlans" },
  { source: "src/pages/LandingPage.tsx:80", key: "common.landing.features.kitchen.title" },
  { source: "src/pages/LandingPage.tsx:82", key: "common.landing.features.kitchen.description" },
  { source: "src/pages/LandingPage.tsx:90", key: "common.landing.features.kitchen.imageAlt" },
  { source: "src/pages/LandingPage.tsx:102", key: "common.landing.features.bar.title" },
  { source: "src/pages/LandingPage.tsx:104", key: "common.landing.features.bar.description" },
  { source: "src/pages/LandingPage.tsx:112", key: "common.landing.features.bar.imageAlt" },
  { source: "src/pages/LandingPage.tsx:124", key: "common.landing.features.menu.title" },
  { source: "src/pages/LandingPage.tsx:126", key: "common.landing.features.menu.description" },
  { source: "src/pages/LandingPage.tsx:134", key: "common.landing.features.menu.imageAlt" },
  { source: "src/pages/LandingPage.tsx:146", key: "common.landing.features.orders.title" },
  { source: "src/pages/LandingPage.tsx:148", key: "common.landing.features.orders.description" },
  { source: "src/pages/LandingPage.tsx:156", key: "common.landing.features.orders.imageAlt" },
  { source: "src/pages/LandingPage.tsx:168", key: "common.landing.features.dashboard.title" },
  { source: "src/pages/LandingPage.tsx:170", key: "common.landing.features.dashboard.description" },
  { source: "src/pages/LandingPage.tsx:178", key: "common.landing.features.dashboard.imageAlt" },
  { source: "src/pages/LandingPage.tsx:190", key: "common.landing.features.history.title" },
  { source: "src/pages/LandingPage.tsx:192", key: "common.landing.features.history.description" },
  { source: "src/pages/LandingPage.tsx:200", key: "common.landing.features.history.imageAlt" },
  { source: "src/pages/LandingPage.tsx:212", key: "common.landing.features.innovation.title" },
  { source: "src/pages/LandingPage.tsx:214", key: "common.landing.features.innovation.description" },
  { source: "src/pages/LandingPage.tsx:222", key: "common.landing.features.innovation.imageAlt" },
  { source: "src/pages/LandingPage.tsx:234", key: "common.landing.features.apps.title" },
  { source: "src/pages/LandingPage.tsx:236", key: "common.landing.features.apps.description" },
  { source: "src/pages/LandingPage.tsx:244", key: "common.landing.features.apps.imageAlt" },
  { source: "src/pages/LandingPage.tsx:254", key: "common.plans.title" },
  { source: "src/pages/LandingPage.tsx:256", key: "common.plans.description" },
  { source: "src/pages/LandingPage.tsx:265", key: "common.plans.monthly" },
  { source: "src/pages/LandingPage.tsx:266", key: "common.plans.monthlyDescription" },
  { source: "src/pages/LandingPage.tsx:271", key: "common.plans.monthlyUnit" },
  { source: "src/pages/LandingPage.tsx:276", key: "common.plans.features.fullAccess" },
  { source: "src/pages/LandingPage.tsx:280", key: "common.plans.features.prioritySupport" },
  { source: "src/pages/LandingPage.tsx:284", key: "common.plans.features.cancelAnytime" },
  { source: "src/pages/LandingPage.tsx:291", key: "common.plans.subscribeMonthly" },
  { source: "src/pages/LandingPage.tsx:299", key: "common.plans.popular" },
  { source: "src/pages/LandingPage.tsx:301", key: "common.plans.annual" },
  { source: "src/pages/LandingPage.tsx:302", key: "common.plans.annualDescription" },
  { source: "src/pages/LandingPage.tsx:307", key: "common.plans.annualUnit" },
  { source: "src/pages/LandingPage.tsx:309", key: "common.plans.equivalentMonthly" },
  { source: "src/pages/LandingPage.tsx:314", key: "common.plans.features.sameAsMonthly" },
  { source: "src/pages/LandingPage.tsx:318", key: "common.plans.features.discount" },
  { source: "src/pages/LandingPage.tsx:322", key: "common.plans.features.annualBilling" },
  { source: "src/pages/LandingPage.tsx:315", key: "common.plans.subscribeAnnual" },
  { source: "src/pages/LoginPage.tsx:70", key: "auth.loginFailure" },
  { source: "src/pages/LoginPage.tsx:98", key: "auth.registrationSuccess" },
  { source: "src/pages/LoginPage.tsx:102", key: "auth.registerFailure" },
  { source: "src/pages/LoginPage.tsx:117", key: "auth.subtitle" },
  { source: "src/pages/LoginPage.tsx:123", key: "auth.login" },
  { source: "src/pages/LoginPage.tsx:124", key: "auth.register" },
  { source: "src/pages/LoginPage.tsx:132", key: "auth.loginDescription" },
  { source: "src/pages/LoginPage.tsx:142", key: "auth.emailPlaceholder" },
  { source: "src/pages/LoginPage.tsx:161", key: "auth.entering" },
  { source: "src/pages/LoginPage.tsx:161", key: "auth.enter" },
  { source: "src/pages/LoginPage.tsx:171", key: "auth.createAccount" },
  { source: "src/pages/LoginPage.tsx:173", key: "auth.registerDescription" },
  { source: "src/pages/LoginPage.tsx:182", key: "auth.responsiblePlaceholder" },
  { source: "src/pages/LoginPage.tsx:193", key: "auth.establishmentPlaceholder" },
  { source: "src/pages/LoginPage.tsx:231", key: "auth.freeAccessLabel" },
  { source: "src/pages/LoginPage.tsx:240", key: "auth.registrationKeyPlaceholder" },
  { source: "src/pages/LoginPage.tsx:250", key: "auth.createAccountLoading" },
  { source: "src/pages/PlanSelectionPage.tsx:36", key: "errors.paymentUrl" },
  { source: "src/pages/PlanSelectionPage.tsx:40", key: "errors.payment" },
  { source: "src/pages/PlanSelectionPage.tsx:53", key: "common.plans.noPlanTitle" },
  { source: "src/pages/PlanSelectionPage.tsx:56", key: "common.plans.noPlanDescription" },
  { source: "src/pages/PlanSelectionPage.tsx:64", key: "common.plans.monthly" },
  { source: "src/pages/PlanSelectionPage.tsx:65", key: "common.plans.monthlyDescription" },
  { source: "src/pages/PlanSelectionPage.tsx:70", key: "common.plans.monthlyUnit" },
  { source: "src/pages/PlanSelectionPage.tsx:73", key: "common.plans.features.fullAccess" },
  { source: "src/pages/PlanSelectionPage.tsx:74", key: "common.plans.features.prioritySupport" },
  { source: "src/pages/PlanSelectionPage.tsx:75", key: "common.plans.features.cancelAnytime" },
  { source: "src/pages/PlanSelectionPage.tsx:84", key: "common.processing" },
  { source: "src/pages/PlanSelectionPage.tsx:84", key: "common.plans.subscribeMonthly" },
  { source: "src/pages/PlanSelectionPage.tsx:92", key: "common.plans.popular" },
  { source: "src/pages/PlanSelectionPage.tsx:95", key: "common.plans.annual" },
  { source: "src/pages/PlanSelectionPage.tsx:96", key: "common.plans.annualDescription" },
  { source: "src/pages/PlanSelectionPage.tsx:101", key: "common.plans.annualUnit" },
  { source: "src/pages/PlanSelectionPage.tsx:103", key: "common.plans.equivalentMonthly" },
  { source: "src/pages/PlanSelectionPage.tsx:105", key: "common.plans.features.sameAsMonthly" },
  { source: "src/pages/PlanSelectionPage.tsx:106", key: "common.plans.features.discount" },
  { source: "src/pages/PlanSelectionPage.tsx:107", key: "common.plans.features.annualBilling" },
  { source: "src/pages/PlanSelectionPage.tsx:116", key: "common.processing" },
  { source: "src/pages/PlanSelectionPage.tsx:116", key: "common.plans.subscribeAnnual" },
  { source: "src/pages/NotFoundPage.tsx:19", key: "common.notFound.code" },
  { source: "src/pages/NotFoundPage.tsx:21", key: "common.notFound.title" },
  { source: "src/pages/NotFoundPage.tsx:24", key: "common.notFound.description" },
  { source: "src/pages/NotFoundPage.tsx:30", key: "common.notFound.back" },
  { source: "src/pages/NotFoundPage.tsx:33", key: "common.notFound.home" },
  { source: "src/pages/PaymentSuccessPage.tsx:28", key: "common.paymentSuccess.title" },
  { source: "src/pages/PaymentSuccessPage.tsx:29", key: "common.paymentSuccess.preparing" },
  { source: "src/pages/PaymentSuccessPage.tsx:30", key: "common.paymentSuccess.redirecting" },
  { source: "src/pages/dashboard/ProductsPage.tsx:189", key: "errors.products.selectType" },
  { source: "src/pages/dashboard/ProductsPage.tsx:205", key: "errors.products.create" },
  { source: "src/pages/dashboard/ProductsPage.tsx:224", key: "errors.products.selectType" },
  { source: "src/pages/dashboard/ProductsPage.tsx:240", key: "errors.products.update" },
  { source: "src/pages/dashboard/ProductsPage.tsx:247", key: "products.confirm.delete" },
  { source: "src/pages/dashboard/ProductsPage.tsx:254", key: "errors.products.delete" },
  { source: "src/pages/dashboard/ProductsPage.tsx:286", key: "errors.products.createType" },
  { source: "src/pages/dashboard/ProductsPage.tsx:311", key: "errors.products.updateType" },
  { source: "src/pages/dashboard/ProductsPage.tsx:321", key: "products.confirm.toggle" },
  { source: "src/pages/dashboard/ProductsPage.tsx:321", key: "products.activateType" },
  { source: "src/pages/dashboard/ProductsPage.tsx:321", key: "products.deactivateType" },
  { source: "src/pages/dashboard/ProductsPage.tsx:331", key: "errors.products.updateTypeStatus" },
  { source: "src/pages/dashboard/ProductsPage.tsx:284", key: "common.notInformed" },
  { source: "src/pages/dashboard/ProductsPage.tsx:370", key: "products.pageTitle" },
  { source: "src/pages/dashboard/ProductsPage.tsx:373", key: "products.title" },
  { source: "src/pages/dashboard/ProductsPage.tsx:359", key: "products.tabs.products" },
  { source: "src/pages/dashboard/ProductsPage.tsx:360", key: "products.tabs.types" },
  { source: "src/pages/dashboard/ProductsPage.tsx:367", key: "products.new" },
  { source: "src/pages/dashboard/ProductsPage.tsx:372", key: "products.dialogs.addProductTitle" },
  { source: "src/pages/dashboard/ProductsPage.tsx:374", key: "products.dialogs.addProductDescription" },
  { source: "src/pages/dashboard/ProductsPage.tsx:393", key: "products.forms.pricePlaceholder" },
  { source: "src/pages/dashboard/ProductsPage.tsx:401", key: "products.forms.typePlaceholder" },
  { source: "src/pages/dashboard/ProductsPage.tsx:418", key: "products.forms.ingredientsPlaceholder" },
  { source: "src/pages/dashboard/ProductsPage.tsx:422", key: "common.save" },
  { source: "src/pages/dashboard/ProductsPage.tsx:436", key: "products.newType" },
  { source: "src/pages/dashboard/ProductsPage.tsx:441", key: "products.dialogs.addTypeTitle" },
  { source: "src/pages/dashboard/ProductsPage.tsx:443", key: "products.dialogs.addTypeDescription" },
  { source: "src/pages/dashboard/ProductsPage.tsx:481", key: "products.menu" },
  { source: "src/pages/dashboard/ProductsPage.tsx:485", key: "products.table.searchPlaceholder" },
  { source: "src/pages/dashboard/ProductsPage.tsx:489", key: "common.recordsTotal" },
  { source: "src/pages/dashboard/ProductsPage.tsx:499", key: "common.index" },
  { source: "src/pages/dashboard/ProductsPage.tsx:500", key: "products.name" },
  { source: "src/pages/dashboard/ProductsPage.tsx:501", key: "products.type" },
  { source: "src/pages/dashboard/ProductsPage.tsx:502", key: "products.price" },
  { source: "src/pages/dashboard/ProductsPage.tsx:503", key: "common.actions.label" },
  { source: "src/pages/dashboard/ProductsPage.tsx:602", key: "products.types" },
  { source: "src/pages/dashboard/ProductsPage.tsx:606", key: "products.table.typesSearchPlaceholder" },
  { source: "src/pages/dashboard/ProductsPage.tsx:619", key: "products.table.typesCaption" },
  { source: "src/pages/dashboard/ProductsPage.tsx:623", key: "common.description" },
  { source: "src/pages/dashboard/ProductsPage.tsx:624", key: "products.table.origin" },
  { source: "src/pages/dashboard/ProductsPage.tsx:625", key: "common.actions.label" },
  { source: "src/pages/dashboard/ProductsPage.tsx:658", key: "products.table.inactiveSuffix" },
  { source: "src/pages/dashboard/ProductsPage.tsx:660", key: "products.table.systemOrigin" },
  { source: "src/pages/dashboard/ProductsPage.tsx:660", key: "products.table.userOrigin" },
  { source: "src/pages/dashboard/ProductsPage.tsx:684", key: "products.accessibility.activateType" },
  { source: "src/pages/dashboard/ProductsPage.tsx:684", key: "products.accessibility.deactivateType" },
  { source: "src/pages/dashboard/ProductsPage.tsx:724", key: "products.dialogs.editProductTitle" },
  { source: "src/pages/dashboard/ProductsPage.tsx:726", key: "products.dialogs.editProductDescription" },
  { source: "src/pages/dashboard/ProductsPage.tsx:752", key: "products.forms.typePlaceholder" },
  { source: "src/pages/dashboard/ProductsPage.tsx:769", key: "products.forms.ingredientsPlaceholder" },
  { source: "src/pages/dashboard/ProductsPage.tsx:773", key: "common.saveChanges" },
  { source: "src/pages/dashboard/ProductsPage.tsx:786", key: "products.dialogs.editTypeTitle" },
  { source: "src/pages/dashboard/ProductsPage.tsx:788", key: "products.dialogs.editTypeDescription" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:191", key: "employees.confirm.delete" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:148", key: "errors.employees.create" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:184", key: "errors.employees.update" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:198", key: "errors.employees.delete" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:245", key: "employees.pageTitle" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:248", key: "employees.title" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:243", key: "employees.addButton" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:248", key: "employees.dialog.addTitle" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:250", key: "employees.dialog.addDescription" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:279", key: "employees.selectRole" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:300", key: "common.save" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:320", key: "employees.team" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:324", key: "employees.table.searchPlaceholder" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:339", key: "common.index" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:344", key: "common.actions.label" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:215", key: "employees.role.owner" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:216", key: "employees.role.manager" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:217", key: "employees.role.employee" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:218", key: "employees.role.customer" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:283", key: "employees.roleLabel" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:226", key: "common.notInformed" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:411", key: "employees.table.totalRecords" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:432", key: "employees.dialog.editTitle" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:434", key: "employees.dialog.editDescription" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:473", key: "employees.newPassword" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:479", key: "employees.leaveBlank" },
  { source: "src/pages/dashboard/EmployeesPage.tsx:488", key: "common.saveChanges" },
  { source: "src/pages/dashboard/ChartsPage.tsx:606", key: "charts.pageTitle" },
  { source: "src/pages/dashboard/ChartsPage.tsx:609", key: "charts.title" },
  { source: "src/pages/dashboard/ChartsPage.tsx", key: "common.recordCount.zero" },
  { source: "src/pages/dashboard/ChartsPage.tsx", key: "common.recordCount.one" },
  { source: "src/pages/dashboard/ChartsPage.tsx", key: "common.recordCount.two" },
  { source: "src/pages/dashboard/ChartsPage.tsx", key: "common.recordCount.few" },
  { source: "src/pages/dashboard/ChartsPage.tsx", key: "common.recordCount.many" },
  { source: "src/pages/dashboard/ChartsPage.tsx", key: "common.recordCount.other" },
  { source: "src/pages/dashboard/ChartsPage.tsx", key: "common.unitCount.zero" },
  { source: "src/pages/dashboard/ChartsPage.tsx", key: "common.unitCount.one" },
  { source: "src/pages/dashboard/ChartsPage.tsx", key: "common.unitCount.two" },
  { source: "src/pages/dashboard/ChartsPage.tsx", key: "common.unitCount.few" },
  { source: "src/pages/dashboard/ChartsPage.tsx", key: "common.unitCount.many" },
  { source: "src/pages/dashboard/ChartsPage.tsx", key: "common.unitCount.other" },
  { source: "src/pages/dashboard/ChartsPage.tsx:939", key: "common.notInformed" },
  { source: "src/components/Navbar.tsx", key: "common.notInformed" },
  { source: "src/components/Navbar.tsx", key: "auth.pendingPayment" },
  { source: "src/pages/dashboard/ChartsPage.tsx:557", key: "charts.tabs.products" },
  { source: "src/pages/dashboard/ChartsPage.tsx:558", key: "charts.tabs.hours" },
  { source: "src/pages/dashboard/ChartsPage.tsx:564", key: "charts.filters.title" },
  { source: "src/pages/dashboard/ChartsPage.tsx:569", key: "charts.filters.startDate" },
  { source: "src/pages/dashboard/ChartsPage.tsx:578", key: "charts.filters.startTime" },
  { source: "src/pages/dashboard/ChartsPage.tsx:587", key: "charts.filters.endDate" },
  { source: "src/pages/dashboard/ChartsPage.tsx:596", key: "charts.filters.endTime" },
  { source: "src/pages/dashboard/ChartsPage.tsx:605", key: "charts.filters.foodType" },
  { source: "src/pages/dashboard/ChartsPage.tsx:608", key: "charts.filters.select" },
  { source: "src/pages/dashboard/ChartsPage.tsx:611", key: "charts.filters.all" },
  { source: "src/pages/dashboard/ChartsPage.tsx:626", key: "charts.report.generateExcel" },
  { source: "src/pages/dashboard/ChartsPage.tsx:634", key: "charts.report.generatePdf" },
  { source: "src/pages/dashboard/ChartsPage.tsx", key: "charts.report.filename" },
  { source: "src/pages/dashboard/ChartsPage.tsx", key: "charts.report.generatingWithFormat" },
  { source: "src/pages/dashboard/ChartsPage.tsx", key: "charts.report.format.excel" },
  { source: "src/pages/dashboard/ChartsPage.tsx", key: "charts.report.format.pdf" },
  { source: "src/pages/dashboard/ChartsPage.tsx:639", key: "charts.filters.search" },
  { source: "src/pages/dashboard/ChartsPage.tsx:647", key: "charts.report.viewStatus" },
  { source: "src/pages/dashboard/ChartsPage.tsx:664", key: "charts.visualization.title" },
  { source: "src/pages/dashboard/ChartsPage.tsx:668", key: "charts.visualization.select" },
  { source: "src/pages/dashboard/ChartsPage.tsx:671", key: "charts.visualization.revenue" },
  { source: "src/pages/dashboard/ChartsPage.tsx:672", key: "charts.visualization.salesCount" },
  { source: "src/pages/dashboard/ChartsPage.tsx:673", key: "charts.visualization.revenueAndSales" },
  { source: "src/pages/dashboard/ChartsPage.tsx:674", key: "charts.visualization.salesPie" },
  { source: "src/pages/dashboard/ChartsPage.tsx", key: "charts.visualization.pieLabel" },
  { source: "src/pages/dashboard/ChartsPage.tsx:691", key: "charts.summary.totalRevenue" },
  { source: "src/pages/dashboard/ChartsPage.tsx:696", key: "charts.summary.totalSales" },
  { source: "src/pages/dashboard/ChartsPage.tsx:700", key: "charts.summary.unitsSold" },
  { source: "src/pages/dashboard/ChartsPage.tsx:713", key: "charts.empty.filtered" },
  { source: "src/pages/dashboard/ChartsPage.tsx:723", key: "charts.details.title" },
  { source: "src/pages/dashboard/ChartsPage.tsx:728", key: "charts.details.totalRecords" },
  { source: "src/pages/dashboard/ChartsPage.tsx:732", key: "common.index" },
  { source: "src/pages/dashboard/ChartsPage.tsx:733", key: "products.name" },
  { source: "src/pages/dashboard/ChartsPage.tsx:734", key: "charts.details.quantitySold" },
  { source: "src/pages/dashboard/ChartsPage.tsx:735", key: "charts.details.totalRevenue" },
  { source: "src/pages/dashboard/ChartsPage.tsx:790", key: "charts.filters.title" },
  { source: "src/pages/dashboard/ChartsPage.tsx:795", key: "charts.filters.startDate" },
  { source: "src/pages/dashboard/ChartsPage.tsx:804", key: "charts.filters.endDate" },
  { source: "src/pages/dashboard/ChartsPage.tsx:820", key: "charts.filters.search" },
  { source: "src/pages/dashboard/ChartsPage.tsx:829", key: "charts.hourly.title" },
  { source: "src/pages/dashboard/ChartsPage.tsx:847", key: "charts.summary.totalSales" },
  { source: "src/pages/dashboard/ChartsPage.tsx:851", key: "charts.summary.dayRevenue" },
  { source: "src/pages/dashboard/ChartsPage.tsx:858", key: "charts.summary.peakHour" },
  { source: "src/pages/dashboard/ChartsPage.tsx:879", key: "charts.dayOf" },
  { source: "src/pages/dashboard/ChartsPage.tsx:911", key: "charts.tooltip.sales" },
  { source: "src/pages/dashboard/ChartsPage.tsx:912", key: "charts.tooltip.revenue" },
  { source: "src/pages/dashboard/ChartsPage.tsx:915", key: "charts.tooltip.details" },
  { source: "src/pages/dashboard/ChartsPage.tsx:926", key: "charts.tooltip.more" },
  { source: "src/pages/dashboard/ChartsPage.tsx", key: "charts.tooltip.label" },
  { source: "src/pages/dashboard/ChartsPage.tsx:933", key: "charts.empty.noSalesForDay" },
  { source: "src/pages/dashboard/ChartsPage.tsx:933", key: "charts.empty.selectPeriod" },
  { source: "src/pages/dashboard/ChartsPage.tsx:363", key: "charts.report.downloadFailed" },
  { source: "src/pages/dashboard/ChartsPage.tsx:395", key: "charts.report.generationFailed" },
  { source: "src/pages/dashboard/ChartsPage.tsx:403", key: "charts.report.timeout" },
  { source: "src/pages/dashboard/ChartsPage.tsx:438", key: "charts.report.readyWithoutUrl" },
  { source: "src/pages/dashboard/ChartsPage.tsx:443", key: "charts.report.pollingFailed" },
  { source: "src/pages/dashboard/ChartsPage.tsx:454", key: "charts.report.invalidResponse" },
  { source: "src/pages/dashboard/ChartsPage.tsx:458", key: "charts.report.startFailed" },
  { source: "src/pages/dashboard/ChartsPage.tsx:463", key: "charts.report.startFailed" },
  { source: "src/components/dashboard/PedidosTab.tsx:39", key: "orders.fallback.product" },
  { source: "src/components/dashboard/PedidosTab.tsx:56", key: "status.open" },
  { source: "src/components/dashboard/PedidosTab.tsx:56", key: "status.inPreparation" },
  { source: "src/components/dashboard/PedidosTab.tsx:56", key: "status.delivering" },
  { source: "src/components/dashboard/PedidosTab.tsx:56", key: "status.closed" },
  { source: "src/components/dashboard/PedidosTab.tsx:141", key: "errors.loadOrders" },
  { source: "src/components/dashboard/PedidosTab.tsx:257", key: "errors.saveOrder" },
  { source: "src/components/dashboard/PedidosTab.tsx:269", key: "errors.deleteOrder" },
  { source: "src/components/dashboard/PedidosTab.tsx:282", key: "errors.closeOrder" },
  { source: "src/components/dashboard/PedidosTab.tsx:293", key: "errors.changeOrderStatus" },
  { source: "src/components/dashboard/PedidosTab.tsx:262", key: "orders.confirm.delete" },
  { source: "src/components/dashboard/PedidosTab.tsx:276", key: "orders.confirm.close" },
  { source: "src/components/dashboard/PedidosTab.tsx:315", key: "orders.edit" },
  { source: "src/components/dashboard/PedidosTab.tsx:315", key: "orders.new" },
  { source: "src/components/dashboard/PedidosTab.tsx:326", key: "orders.recent" },
  { source: "src/components/dashboard/PedidosTab.tsx:329", key: "common.loading" },
  { source: "src/components/dashboard/PedidosTab.tsx:332", key: "common.index" },
  { source: "src/components/dashboard/PedidosTab.tsx:333", key: "common.customer" },
  { source: "src/components/dashboard/PedidosTab.tsx:334", key: "common.createdBy" },
  { source: "src/components/dashboard/PedidosTab.tsx:335", key: "common.status" },
  { source: "src/components/dashboard/PedidosTab.tsx:336", key: "common.date" },
  { source: "src/components/dashboard/PedidosTab.tsx:337", key: "common.total" },
  { source: "src/components/dashboard/PedidosTab.tsx:337", key: "common.actions.label" },
  { source: "src/components/dashboard/PedidosTab.tsx:361", key: "orders.empty" },
  { source: "src/components/dashboard/PedidosTab.tsx:369", key: "common.notInformed" },
  { source: "src/components/dashboard/PedidosTab.tsx:386", key: "orders.confirm.changeStatus" },
  { source: "src/components/dashboard/PedidosTab.tsx:400", key: "orders.editLabel" },
  { source: "src/components/dashboard/PedidosTab.tsx:403", key: "orders.deleteLabel" },
  { source: "src/components/dashboard/VendasTab.tsx:47", key: "sales.fallback.product" },
  { source: "src/components/dashboard/VendasTab.tsx:153", key: "errors.loadSales" },
  { source: "src/components/dashboard/VendasTab.tsx:229", key: "errors.createSale" },
  { source: "src/components/dashboard/VendasTab.tsx:256", key: "errors.saleDetails" },
  { source: "src/components/dashboard/VendasTab.tsx:278", key: "errors.cancelSale" },
  { source: "src/components/dashboard/VendasTab.tsx:300", key: "sales.new" },
  { source: "src/components/dashboard/VendasTab.tsx:309", key: "sales.details" },
  { source: "src/components/dashboard/VendasTab.tsx:309", key: "sales.new" },
  { source: "src/components/dashboard/VendasTab.tsx:319", key: "sales.period" },
  { source: "src/components/dashboard/VendasTab.tsx:320", key: "sales.table.totalRecords" },
  { source: "src/components/dashboard/VendasTab.tsx:323", key: "sales.closingPeriod" },
  { source: "src/components/dashboard/VendasTab.tsx:330", key: "common.loading" },
  { source: "src/components/dashboard/VendasTab.tsx:333", key: "common.index" },
  { source: "src/components/dashboard/VendasTab.tsx:334", key: "common.customer" },
  { source: "src/components/dashboard/VendasTab.tsx:335", key: "common.createdBy" },
  { source: "src/components/dashboard/VendasTab.tsx:336", key: "common.date" },
  { source: "src/components/dashboard/VendasTab.tsx:337", key: "common.total" },
  { source: "src/components/dashboard/VendasTab.tsx:338", key: "common.actions.label" },
  { source: "src/components/dashboard/VendasTab.tsx:359", key: "sales.empty" },
  { source: "src/components/dashboard/VendasTab.tsx:367", key: "common.notInformed" },
  { source: "src/components/dashboard/VendasTab.tsx:384", key: "printer.printSoon" },
  { source: "src/components/dashboard/VendasTab.tsx:387", key: "sales.viewDetails" },
  { source: "src/pages/dashboard/OrdersPage.tsx:10", key: "orders.pageTitle" },
  { source: "src/pages/dashboard/OrdersPage.tsx:11", key: "orders.title" },
  { source: "src/pages/dashboard/SalesPage.tsx:10", key: "sales.pageTitle" },
  { source: "src/pages/dashboard/SalesPage.tsx:11", key: "sales.title" },
  { source: "src/pages/dashboard/SettingsPage.tsx:16", key: "settings.title" },
  { source: "src/pages/dashboard/SettingsPage.tsx:19", key: "settings.appearance" },
  { source: "src/pages/dashboard/SettingsPage.tsx:21", key: "settings.system" },
  { source: "src/pages/dashboard/SettingsPage.tsx:27", key: "settings.language" },
  { source: "src/pages/dashboard/SettingsPage.tsx:30", key: "settings.currentLanguage" },
  { source: "src/pages/dashboard/SettingsPage.tsx:54", key: "settings.localeIndicator" },
  { source: "src/pages/dashboard/SettingsPage.tsx:41", key: "settings.locales.en" },
  { source: "src/pages/dashboard/SettingsPage.tsx:41", key: "settings.locales.pt-BR" },
  { source: "src/pages/dashboard/SettingsPage.tsx:41", key: "settings.locales.es" },
  { source: "src/pages/dashboard/SettingsPage.tsx:41", key: "settings.locales.fr" },
  { source: "src/pages/dashboard/SettingsPage.tsx:41", key: "settings.locales.zh" },
  { source: "src/pages/dashboard/SettingsPage.tsx:41", key: "settings.locales.hi" },
  { source: "src/pages/dashboard/SettingsPage.tsx:41", key: "settings.locales.ar" },
  { source: "src/pages/dashboard/SettingsPage.tsx:59", key: "settings.moreComingSoon" },
]

const firstBatchNamespaces = new Set(["common", "auth", "navigation", "settings", "status", "printer", "errors"])
const firstBatchUiInventory = requiredUiInventory.filter(({ key }) => firstBatchNamespaces.has(key.split(".")[0]))
const requiredSourceCoordinates = [
  { source: "src/contexts/AuthContext.tsx:78", marker: "PENDING_PAYMENT" },
]

function hasResourceLeaf(resource: unknown, key: string): boolean {
  let current: unknown = resource
  for (const segment of key.split(".")) {
    if (!current || typeof current !== "object" || !(segment in current)) return false
    current = (current as Record<string, unknown>)[segment]
  }
  return typeof current === "string" && current.trim().length > 0
}

function sourceFile(source: string): string {
  return source.replace(/:\d+$/, "")
}

function sourceLine(source: string): number | undefined {
  const match = source.match(/:(\d+)$/)
  return match ? Number(match[1]) : undefined
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function hasTranslationUsage(sourceText: string, key: string): boolean {
  const namespace = key.split(".")[0]
  const leaf = key.split(".").slice(1).join(".")
  const exactUsage = new RegExp(
    `\\bt[A-Za-z0-9_]*\\s*\\(\\s*[\"']${escapeRegExp(leaf)}[\"']`,
  )
  if (exactUsage.test(sourceText)) return true

  // These boundaries deliberately stay small and explicit: the UI calls a
  // stable error-code/status helper, which performs the final namespace lookup
  // outside the component rather than repeating a literal t() call there.
  if (namespace === "errors" && /\b(?:localizedError|translateError|getErrorTranslationKey)\s*\(/.test(sourceText)) return true
  if (namespace === "auth" && /\btranslateError\s*\(/.test(sourceText)) return true
  if (namespace === "status" && /\bgetStatusLabel\s*\(/.test(sourceText)) return true

  // Settings renders locale labels through a template key. This small lexical
  // exception verifies the stable namespace path without parsing TypeScript.
  const parent = leaf.slice(0, leaf.lastIndexOf("."))
  if (!parent) return false
  const dynamicUsage = new RegExp(
    "\\bt[A-Za-z0-9_]*\\s*\\(\\s*`" + escapeRegExp(parent) + "\\.\\$\\{",
  )
  return dynamicUsage.test(sourceText)
}

describe("current hardcoded UI inventory", () => {
  test("has a translated resource leaf for the first local inventory batch in every locale", () => {
    const missing = Object.entries(resources).flatMap(([locale, localeResource]) =>
      firstBatchUiInventory
        .filter(({ key }) => !hasResourceLeaf(localeResource, key))
        .map(({ source, key }) => `${locale}: ${key} (${source})`),
    )

    expect(missing).toEqual([])
  })

  test("has a translated resource leaf for every inventoried UI string in every locale", () => {
    const missing = Object.entries(resources).flatMap(([locale, localeResource]) =>
      requiredUiInventory
        .filter(({ key }) => !hasResourceLeaf(localeResource, key))
        .map(({ source, key }) => `${locale}: ${key} (${source})`),
    )

    expect(missing).toEqual([])
  })

  test("verifies every inventory entry is used by a translation call in its source file", async () => {
    const sourceTextCache = new Map<string, string>()
    const missingUsage: string[] = []

    for (const { source, key } of requiredUiInventory) {
      const filename = sourceFile(source)
      let sourceText = sourceTextCache.get(filename)
      if (!sourceText) {
        sourceText = await Bun.file(new URL(`../../${filename}`, import.meta.url)).text()
        sourceTextCache.set(filename, sourceText)
      }

      if (!hasTranslationUsage(sourceText, key)) {
        missingUsage.push(`${key} (${source})`)
      }
    }

    expect(missingUsage).toEqual([])
  })

  test("keeps inventoried coordinates and structured auth coverage anchored to source lines", async () => {
    const sourceTextCache = new Map<string, string>()
    const coordinateIssues: string[] = []
    const readSource = async (filename: string) => {
      const cached = sourceTextCache.get(filename)
      if (cached !== undefined) return cached
      const sourceText = await Bun.file(new URL(`../../${filename}`, import.meta.url)).text()
      sourceTextCache.set(filename, sourceText)
      return sourceText
    }

    for (const { source } of requiredUiInventory) {
      const filename = sourceFile(source)
      const line = sourceLine(source)
      if (line === undefined) continue
      const lines = (await readSource(filename)).split(/\r?\n/)
      if (line < 1 || line > lines.length) coordinateIssues.push(`${source}: out of bounds`)
    }

    for (const { source, marker } of requiredSourceCoordinates) {
      const filename = sourceFile(source)
      const line = sourceLine(source)
      const lines = (await readSource(filename)).split(/\r?\n/)
      if (line === undefined || line < 1 || line > lines.length) {
        coordinateIssues.push(`${source}: out of bounds`)
        continue
      }
      if (!lines[line - 1].includes(marker)) {
        coordinateIssues.push(`${source}: missing ${marker}`)
      }
    }

    expect(coordinateIssues).toEqual([])
  })
})
